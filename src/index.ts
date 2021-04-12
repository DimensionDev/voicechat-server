import { Server, Socket } from 'socket.io'
import { v4 as uuid } from 'uuid'
const PORT = 3000

const channels: Record<string, Record<string, SocketWithExtraData>> = {}
const sockets: Record<string, Socket> = {}

interface WebsocketInt {
    io: Server
    getUniqueID(): string
    channels: Record<string, unknown>
}

const IO = new Server(PORT, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
})
console.log('-- Voicechat Server running on ::', PORT)

const wss: WebsocketInt = {
    io: IO,
    getUniqueID: uuid,
    channels: {},
}

// Allow process to catch SIGINT from docker
process.on('SIGINT', () => {
    console.info('Interrupted')
    process.exit(0)
})

interface SocketWithExtraData extends Socket {
    userdata: unknown
    channels: Record<string, unknown>
}
/**
 * Users will connect to the signaling server, after which they'll issue a "join"
 * to join a particular channel. The signaling server keeps track of all sockets
 * who are in a channel, and on join will send out 'addPeer' events to each pair
 * of users in a channel. When clients receive the 'addPeer' even they'll begin
 * setting up an RTCPeerConnection with one another. During this process they'll
 * need to relay ICECandidate information to one another, as well as SessionDescription
 * information. After all of that happens, they'll finally be able to complete
 * the peer connection and will be streaming audio/video between eachother.
 */
wss.io.on('connection', function (socket: SocketWithExtraData) {
    socket.channels = Object.create(null)

    sockets[socket.id] = socket

    console.log(`[${socket.id}] Connection accepted`)

    socket.on('disconnect', function () {
        for (const channel in socket.channels) {
            part(channel)
        }

        console.log(`[${socket.id}] Disconnected`)

        delete sockets[socket.id]
    })

    socket.on('join', function (config: { userdata: unknown; channel: string }) {
        socket.userdata = config.userdata
        console.log(`[${socket.id}] joining`, config)

        const channel = config.channel

        if (channel in socket.channels) {
            console.log(`[${socket.id}] ERROR: Already joined`)
            return
        }

        if (!(channel in channels)) {
            channels[channel] = Object.create(null)
        }

        for (const id in channels[channel]) {
            channels[channel][id].emit('addPeer', {
                peer_id: socket.id,
                should_create_offer: false,
                userdata: socket.userdata,
            })
            socket.emit('addPeer', { peer_id: id, should_create_offer: true, userdata: channels[channel][id].userdata })
        }

        channels[channel][socket.id] = socket
        socket.channels[channel] = channel
    })

    const part = (channel: string) => {
        console.log(`[${socket.id}] part`)

        if (!(channel in socket.channels)) {
            console.log(`[${socket.id}] ERROR: Not in `, channel)
            return
        }

        delete socket.channels[channel]
        delete channels[channel][socket.id]

        for (const id in channels[channel]) {
            channels[channel][id].emit('removePeer', { peer_id: socket.id })
            socket.emit('removePeer', { peer_id: id })
        }
    }

    socket.on('part', part)

    type Type1 = {
        peer_id: string
        ice_candidate: string
    }
    socket.on('relayICECandidate', (config: Type1) => {
        const peerID = config.peer_id
        const iceCandidate = config.ice_candidate

        console.log(`[${socket.id}] relaying ICE candidate to [${peerID}]`, iceCandidate)

        if (peerID in sockets) {
            sockets[peerID].emit('iceCandidate', { peer_id: socket.id, ice_candidate: iceCandidate })
        }
    })

    socket.on('relaySessionDescription', (config: Type1 & { session_description: string }) => {
        const peerID = config.peer_id
        const sessionDescription = config.session_description

        console.log(`[${socket.id}] relaying session description to [${peerID}]`, sessionDescription)

        if (peerID in sockets) {
            sockets[peerID].emit('sessionDescription', { peer_id: socket.id, session_description: sessionDescription })
        }
    })
})
