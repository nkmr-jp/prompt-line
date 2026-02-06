# Makefile for native macOS tools

# Compiler settings
SWIFTC = swiftc
SWIFT_FLAGS = -O
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools

# Single-file tools
SINGLE_FILE_SOURCES = window-detector.swift keyboard-simulator.swift text-field-detector.swift

# Multi-file directory-detector sources (order matters for readability, not compilation)
# Note: file-searcher and symbol-searcher have been migrated to Node.js implementations
DIRECTORY_DETECTOR_SOURCES = \
	directory-detector/CWDDetector.swift \
	directory-detector/TerminalDetector.swift \
	directory-detector/IDEDetector.swift \
	directory-detector/ProcessTree.swift \
	directory-detector/MultiplexerDetector.swift \
	directory-detector/DirectoryDetector.swift \
	directory-detector/main.swift

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

# directory-detector: multi-file compilation with libproc bridging header
# Uses libproc for fast CWD detection (10-50x faster than lsof)
$(OUTPUT_DIR)/directory-detector: $(DIRECTORY_DETECTOR_SOURCES) libproc-bridge.h | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) $(FRAMEWORKS) $(BRIDGING_HEADER) -o $@ $(DIRECTORY_DETECTOR_SOURCES)

install: all
	chmod +x $(TARGETS)

clean:
	rm -rf $(OUTPUT_DIR)

# Rebuild everything
rebuild: clean all install