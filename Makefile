FILES=whisper.js crypto/{nacl,pgp,nocrypto,saltshaker}.js transport/{codec,libp2p,ws}.js
NACLWS=whisper.js crypto/{nacl,nocrypto,saltshaker}.js transport/{codec,ws}.js
PGPWS=whisper.js crypto/{pgp,nocrypto}.js transport/{codec,ws}.js
NACLLIBP2P=whisper.js crypto/{nacl,nocrypto,saltshaker}.js transport/{codec,libp2p}.js
PGPLIBP2P=whisper.js crypto/{pgp,nocrypto}.js transport/{codec,libp2p}.js

test:
	npm run test
build:
	npm run min
# npm run dev-min # it does not finish since i added libp2p
	npm run ls
ls:
	ls -hlG whisper.${npm_package_version}.*

	@echo ""

	$(eval FILE="whisper.${npm_package_version}.min.js")
	$(eval SIZE=$(shell cat ${FILE} | wc -c))
	$(eval ZSIZE=$(shell zip -qr - ${FILE} | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	$(eval ZSIZE=$(shell units -t "${ZSIZE}bytes" "kilobyte"))
	@echo "$(FILE) => ${SIZE}kb => ${ZSIZE}kb zipped"

	$(eval FILE="whisper-naclws.${npm_package_version}.min.js")
	$(eval SIZE=$(shell cat ${FILE} | wc -c))
	$(eval ZSIZE=$(shell zip -qr - ${FILE} | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	$(eval ZSIZE=$(shell units -t "${ZSIZE}bytes" "kilobyte"))
	@echo "$(FILE) => ${SIZE}kb => ${ZSIZE}kb zipped"

	$(eval FILE="whisper-pgpws.${npm_package_version}.min.js")
	$(eval SIZE=$(shell cat ${FILE} | wc -c))
	$(eval ZSIZE=$(shell zip -qr - ${FILE} | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	$(eval ZSIZE=$(shell units -t "${ZSIZE}bytes" "kilobyte"))
	@echo "$(FILE) => ${SIZE}kb => ${ZSIZE}kb zipped"

	$(eval FILE="whisper-nacllibp2p.${npm_package_version}.min.js")
	$(eval SIZE=$(shell cat ${FILE} | wc -c))
	$(eval ZSIZE=$(shell zip -qr - ${FILE} | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	$(eval ZSIZE=$(shell units -t "${ZSIZE}bytes" "kilobyte"))
	@echo "$(FILE) => ${SIZE}kb => ${ZSIZE}kb zipped"

	$(eval FILE="whisper-pgplibp2p.${npm_package_version}.min.js")
	$(eval SIZE=$(shell cat ${FILE} | wc -c))
	$(eval ZSIZE=$(shell zip -qr - ${FILE} | wc -c))
	$(eval SIZE=$(shell units -t "${SIZE}bytes" "kilobyte"))
	$(eval ZSIZE=$(shell units -t "${ZSIZE}bytes" "kilobyte"))
	@echo "$(FILE) => ${SIZE}kb => ${ZSIZE}kb zipped"

min:
	browserify -p tinyify ${FILES} -o whisper.${npm_package_version}.min.js
	browserify -p tinyify ${NACLWS} -o whisper-naclws.${npm_package_version}.min.js
	browserify -p tinyify ${PGPWS} -o whisper-pgpws.${npm_package_version}.min.js
	browserify -p tinyify ${NACLLIBP2P} -o whisper-nacllibp2p.${npm_package_version}.min.js
	browserify -p tinyify ${PGPLIBP2P} -o whisper-pgplibp2p.${npm_package_version}.min.js
dev-min:
	browserify -d -p tinyify ${FILES} -o whisper.${npm_package_version}.dev.min.js
