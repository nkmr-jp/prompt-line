# Makefile for native macOS tools

# Compiler settings
SWIFTC = swiftc
SWIFT_FLAGS = -O
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools
SOURCES = window-detector.swift keyboard-simulator.swift text-field-detector.swift directory-detector.swift
TARGETS = $(OUTPUT_DIR)/window-detector $(OUTPUT_DIR)/keyboard-simulator $(OUTPUT_DIR)/text-field-detector $(OUTPUT_DIR)/directory-detector

# Bridging header for libproc (used by directory-detector for fast CWD detection)
BRIDGING_HEADER = -import-objc-header libproc-bridge.h

.PHONY: all clean install

all: $(TARGETS)

$(OUTPUT_DIR):
	mkdir -p $(OUTPUT_DIR)

$(OUTPUT_DIR)/window-detector: window-detector.swift | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) $(FRAMEWORKS) -o $@ $<

$(OUTPUT_DIR)/keyboard-simulator: keyboard-simulator.swift | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) $(FRAMEWORKS) -o $@ $<

$(OUTPUT_DIR)/text-field-detector: text-field-detector.swift | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) $(FRAMEWORKS) -o $@ $<

# directory-detector uses libproc for fast CWD detection (10-50x faster than lsof)
$(OUTPUT_DIR)/directory-detector: directory-detector.swift libproc-bridge.h | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) $(FRAMEWORKS) $(BRIDGING_HEADER) -o $@ directory-detector.swift

install: all
	chmod +x $(TARGETS)

clean:
	rm -rf $(OUTPUT_DIR)

# Rebuild everything
rebuild: clean all install