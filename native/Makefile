# Makefile for native macOS tools

# Compiler settings
SWIFTC = swiftc
SWIFT_FLAGS = -O
FRAMEWORKS = -framework Cocoa -framework ApplicationServices
OUTPUT_DIR = ../src/native-tools

# Single-file tools
SINGLE_FILE_SOURCES = window-detector.swift keyboard-simulator.swift text-field-detector.swift

# Multi-file directory-detector sources (order matters for readability, not compilation)
# Note: FileSearch functionality has been moved to file-searcher
DIRECTORY_DETECTOR_SOURCES = \
	directory-detector/CWDDetector.swift \
	directory-detector/TerminalDetector.swift \
	directory-detector/IDEDetector.swift \
	directory-detector/ProcessTree.swift \
	directory-detector/DirectoryDetector.swift \
	directory-detector/main.swift

# Multi-file file-searcher sources
FILE_SEARCHER_SOURCES = \
	file-searcher/Types.swift \
	file-searcher/FileSearcher.swift \
	file-searcher/main.swift

# Multi-file symbol-searcher sources
# Uses rg (ripgrep) command for symbol search
SYMBOL_SEARCHER_SOURCES = \
	symbol-searcher/Types.swift \
	symbol-searcher/SymbolPatterns.swift \
	symbol-searcher/RipgrepExecutor.swift \
	symbol-searcher/CacheManager.swift \
	symbol-searcher/main.swift

TARGETS = $(OUTPUT_DIR)/window-detector $(OUTPUT_DIR)/keyboard-simulator $(OUTPUT_DIR)/text-field-detector $(OUTPUT_DIR)/directory-detector $(OUTPUT_DIR)/file-searcher $(OUTPUT_DIR)/symbol-searcher

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

# file-searcher: multi-file compilation for file search functionality
# Uses fd command for fast file listing
$(OUTPUT_DIR)/file-searcher: $(FILE_SEARCHER_SOURCES) | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) -o $@ $(FILE_SEARCHER_SOURCES)

# symbol-searcher: multi-file compilation for symbol search functionality
# Uses rg (ripgrep) command for pattern-based symbol detection
$(OUTPUT_DIR)/symbol-searcher: $(SYMBOL_SEARCHER_SOURCES) | $(OUTPUT_DIR)
	$(SWIFTC) $(SWIFT_FLAGS) -o $@ $(SYMBOL_SEARCHER_SOURCES)

install: all
	chmod +x $(TARGETS)

clean:
	rm -rf $(OUTPUT_DIR)

# Rebuild everything
rebuild: clean all install