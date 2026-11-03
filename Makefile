FILM ?= films/kuch-bhi-kaise-bechein/film.json
SLUG ?= $(shell basename $(dir $(FILM)))

.PHONY: help voice site preview render encode qa test all clean

help:
	@echo "make site     generate timeline + assemble the render site"
	@echo "make preview  render 3 frames at quarter size (fast sanity check)"
	@echo "make render   render every frame (resumable)"
	@echo "make encode   frames + audio -> mp4"
	@echo "make qa       frame + loudness checks on the finished mp4"
	@echo "make test     end-to-end self test (~2 min, low resolution)"
	@echo "make all      voice + music + mix + site + render + encode + qa"

voice:
	python3 kit/voice.py --film $(FILM) --out build/$(SLUG)

site:
	python3 kit/build.py --film $(FILM) --steps voice,music,site

preview: site
	node kit/render.js --site build/$(SLUG)/site --out build/$(SLUG)/preview \
	  --list=80,470,700 --query="w=540&h=960"

render: site
	python3 kit/build.py --film $(FILM) --steps render

encode:
	python3 kit/encode.py --frames build/$(SLUG)/frames \
	  --audio build/$(SLUG)/mix.wav --out build/$(SLUG)/$(SLUG).mp4

qa:
	python3 kit/qa.py --video build/$(SLUG)/$(SLUG).mp4 --out build/$(SLUG)/qa --frames build/$(SLUG)/qa

test:
	python3 kit/selftest.py

all:
	python3 kit/build.py --film $(FILM)

clean:
	rm -rf build/$(SLUG)
