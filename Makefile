FILM ?= films/kuch-bhi-kaise-bechein/film.json
SLUG ?= $(shell basename $(dir $(FILM)))

.PHONY: help voice site preview render encode all clean

help:
	@echo "make site     generate timeline + assemble the render site"
	@echo "make preview  render 3 frames at quarter size (fast sanity check)"
	@echo "make render   render every frame (resumable)"
	@echo "make encode   frames + audio -> mp4"
	@echo "make all      voice + music + site + render + encode"

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

all:
	python3 kit/build.py --film $(FILM)

clean:
	rm -rf build/$(SLUG)
