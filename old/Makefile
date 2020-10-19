FILES=whisper.js crypto/{nacl,pgp,nocrypto,saltshaker}.js transport/{codec,array,tcp,ws}.js

test:
	npm run test
build:
	npm run min
	npm run dev-min
	npm run ls
ls:
	ls -hlG whisper.${npm_package_version}.*

	$(eval SIZE=$(shell zip -qr - whisper.${npm_package_version}.dev.min.js | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	@echo "whisper.${npm_package_version}.dev.min.js => ${SIZE}kb"

	$(eval SIZE=$(shell zip -qr - whisper.${npm_package_version}.min.js | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	@echo "whisper.${npm_package_version}.min.js => ${SIZE}kb"

min:
	browserify -p tinyify ${FILES} -o whisper.${npm_package_version}.min.js
dev-min:
	browserify -d -p tinyify ${FILES} -o whisper.${npm_package_version}.dev.min.js
