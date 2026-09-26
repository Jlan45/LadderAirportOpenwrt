# Copyright 2026 LadderAirport
# SPDX-License-Identifier: MIT

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for LadderAirport agent
LUCI_DESCRIPTION:=Configure ladder-agent via UCI and show local node runtime status.
LUCI_DEPENDS:=+luci-base +ladder-agent
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=LadderAirport <https://github.com/LadderAirport/LadderAirportOpenwrt>

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
