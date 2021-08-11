image_tag= dimensiondev/voicechat-server

docker-build-latest:
	docker build -t ${image_tag}:latest .

docker-build-stable:
	docker build -t ${image_tag}:stable .
