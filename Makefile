init:
	pnpm i

test:
	pnpm test

build:
	pnpm build

bench:
	pnpm bench

up:
	docker compose up -d || true

down:
	docker compose down -v || true

netem-40ms:
	sudo bash scripts/setup-netem.sh eth0 40ms 10ms 1%

netem-clear:
	sudo bash scripts/clear-netem.sh
