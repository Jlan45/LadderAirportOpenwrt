# Local helpers for the LadderAirport OpenWrt feed.
# Formal package build uses OpenWrt SDK (see .github/workflows).

.PHONY: check-src help

LADDER_SRC ?= $(abspath ../LadderAirport)

help:
	@echo "LadderAirport OpenWrt feed"
	@echo ""
	@echo "  make check-src          Verify LADDER_SRC points at the main monorepo"
	@echo "  LADDER_SRC=$(LADDER_SRC)"
	@echo ""
	@echo "Add this repo as an OpenWrt feed, then:"
	@echo "  make package/ladder-agent/compile V=s"
	@echo ""
	@echo "CI builds all router architectures with openwrt/gh-action-sdk."

check-src:
	@test -f "$(LADDER_SRC)/agent/go.mod" || { \
		echo "LADDER_SRC missing agent/go.mod: $(LADDER_SRC)"; \
		echo "Clone LadderAirport next to this repo, or set LADDER_SRC="; \
		exit 1; \
	}
	@test -d "$(LADDER_SRC)/agent/sing-box" || { \
		echo "LADDER_SRC missing agent/sing-box submodule: $(LADDER_SRC)"; \
		echo "Run: git -C $(LADDER_SRC) submodule update --init --recursive"; \
		exit 1; \
	}
	@test -d "$(LADDER_SRC)/pkg" -a -d "$(LADDER_SRC)/proto" || { \
		echo "LADDER_SRC missing pkg/ or proto/: $(LADDER_SRC)"; \
		exit 1; \
	}
	@echo "OK: LADDER_SRC=$(LADDER_SRC)"
	@git -C "$(LADDER_SRC)" describe --tags --always 2>/dev/null || true
