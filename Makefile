FILES=whisper.js crypto/nacl.js crypto/nocrypto.js transport/array.js transport/tcp.js transport/ws.js

test:
	npm run test
build:
	npm run min
	npm run dev-min
	npm run ls
ls:
	ls -alh whisper.${npm_package_version}.*
min:
	browserify -p tinyify ${FILES} -o whisper.${npm_package_version}.min.js
dev-min:
	browserify -d -p tinyify ${FILES} -o whisper.${npm_package_version}.dev.min.js
