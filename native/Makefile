# Makefile for native macOS tools

# Compiler settings
SWIFTC = swiftc
SWIFT_FLAGS = -O
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools
SOURCES = window-detector.swift keyboard-simulator.swift text-field-detector.swift
TARGETS = $(OUTPUT_DIR)/window-detector $(OUTPUT_DIR)/keyboard-simulator $(OUTPUT_DIR)/text-field-detector

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

install: all
	chmod +x $(TARGETS)

clean:
	rm -rf $(OUTPUT_DIR)

# Rebuild everything
rebuild: clean all install