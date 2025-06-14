/**
 * Test fixtures and sample data for testing
 */

const sampleHistoryItems = [
    {
        text: 'Hello world',
        timestamp: Date.now() - 86400000, // 1 day ago
        id: 'sample-1'
    },
    {
        text: 'This is a multi-line\ntext sample\nwith three lines',
        timestamp: Date.now() - 3600000, // 1 hour ago
        id: 'sample-2'
    },
    {
        text: 'Short text',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        id: 'sample-3'
    },
    {
        text: 'A very long text that might be used to test how the application handles longer content and whether it properly truncates or handles display of such content in the user interface',
        timestamp: Date.now() - 900000, // 15 minutes ago
        id: 'sample-4'
    },
    {
        text: 'Special characters: !@#$%^&*()_+-=[]{}|;:,.<>?',
        timestamp: Date.now() - 300000, // 5 minutes ago
        id: 'sample-5'
    },
    {
        text: 'Code snippet:\nfunction test() {\n  return "hello world";\n}',
        timestamp: Date.now() - 60000, // 1 minute ago
        id: 'sample-6'
    },
    {
        text: 'Recent item',
        timestamp: Date.now() - 10000, // 10 seconds ago
        id: 'sample-7'
    }
];

const sampleDrafts = {
    simple: {
        text: 'Simple draft text',
        timestamp: Date.now() - 120000, // 2 minutes ago
        version: '1.0'
    },
    multiline: {
        text: 'Multi-line draft\nwith several lines\nof content',
        timestamp: Date.now() - 300000, // 5 minutes ago
        version: '1.0'
    },
    empty: {
        text: '',
        timestamp: Date.now() - 60000, // 1 minute ago
        version: '1.0'
    },
    withSpecialChars: {
        text: 'Draft with special chars: 中文, العربية, 🚀, \t\n',
        timestamp: Date.now() - 180000, // 3 minutes ago
        version: '1.0'
    }
};

const sampleConfigs = {
    development: {
        paths: {
            historyFile: '/tmp/test-history.json',
            draftFile: '/tmp/test-draft.json',
            logFile: '/tmp/test-app.log'
        },
        history: {
            maxItems: 10 // Smaller for testing
        },
        draft: {
            saveDelay: 100 // Faster for testing
        },
        logging: {
            level: 'debug',
            enableFileLogging: false
        }
    },
    production: {
        paths: {
            historyFile: '/app/data/history.json',
            draftFile: '/app/data/draft.json',
            logFile: '/app/logs/app.log'
        },
        history: {
            maxItems: 50
        },
        draft: {
            saveDelay: 500
        },
        logging: {
            level: 'info',
            enableFileLogging: true
        }
    }
};

const mockElectronEvents = {
    windowShown: {
        sourceApp: 'TestApp',
        history: sampleHistoryItems.slice(0, 3),
        draft: sampleDrafts.simple.text
    },
    ipcPasteText: {
        text: 'Text to paste',
        expectedResponse: { success: true }
    },
    ipcGetHistory: {
        expectedResponse: sampleHistoryItems
    },
    ipcSaveDraft: {
        text: 'Draft to save',
        expectedResponse: { success: true }
    }
};

const testScenarios = {
    emptyApp: {
        description: 'Fresh application with no data',
        historyData: [],
        draftData: null,
        expectedHistoryCount: 0,
        expectedDraftExists: false
    },
    withHistory: {
        description: 'Application with existing history',
        historyData: sampleHistoryItems.slice(0, 5),
        draftData: null,
        expectedHistoryCount: 5,
        expectedDraftExists: false
    },
    withDraft: {
        description: 'Application with saved draft',
        historyData: [],
        draftData: sampleDrafts.multiline,
        expectedHistoryCount: 0,
        expectedDraftExists: true
    },
    fullData: {
        description: 'Application with both history and draft',
        historyData: sampleHistoryItems,
        draftData: sampleDrafts.simple,
        expectedHistoryCount: 7,
        expectedDraftExists: true
    },
    maxHistoryExceeded: {
        description: 'History exceeding maximum items',
        historyData: Array.from({ length: 60 }, (_, i) => ({
            text: `Item ${i}`,
            timestamp: Date.now() - (60 - i) * 1000,
            id: `item-${i}`
        })),
        draftData: null,
        expectedHistoryCount: 50, // Should be trimmed to max
        expectedDraftExists: false
    }
};

const errorScenarios = {
    fileSystemError: {
        description: 'File system operations fail',
        errorType: 'EACCES',
        errorMessage: 'Permission denied'
    },
    corruptedData: {
        description: 'Data files contain invalid JSON',
        historyFileContent: '{ invalid json',
        draftFileContent: 'not json at all'
    },
    networkError: {
        description: 'Network-related operations fail',
        errorType: 'ENETUNREACH',
        errorMessage: 'Network unreachable'
    }
};

const performanceTestData = {
    largeHistory: Array.from({ length: 1000 }, (_, i) => ({
        text: `Performance test item ${i} with some longer content to simulate real usage patterns`,
        timestamp: Date.now() - i * 1000,
        id: `perf-${i}`
    })),
    longText: 'A'.repeat(10000), // 10KB of text
    manySmallItems: Array.from({ length: 100 }, (_, i) => ({
        text: `Item ${i}`,
        timestamp: Date.now() - i * 100,
        id: `small-${i}`
    }))
};

// Helper functions for creating test data
function createRandomHistoryItem(index = 0) {
    const texts = [
        'Random text sample',
        'Code: console.log("test")',
        'Multi\nline\ntext',
        'Special chars: ñáéíóú',
        'Numbers: 12345',
        'Mixed: Text123!@#'
    ];
    
    return {
        text: texts[index % texts.length] + ` #${index}`,
        timestamp: Date.now() - Math.random() * 86400000, // Random time within last day
        id: `random-${index}-${Math.random().toString(36).substr(2, 9)}`
    };
}

function createTestDraft(text = 'Test draft', timestamp = Date.now()) {
    return {
        text,
        timestamp,
        version: '1.0'
    };
}

function createMockWindow() {
    return {
        loadFile: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        focus: jest.fn(),
        destroy: jest.fn(),
        isVisible: jest.fn(() => false),
        setPosition: jest.fn(),
        on: jest.fn(),
        webContents: {
            send: jest.fn(),
            on: jest.fn()
        }
    };
}

module.exports = {
    sampleHistoryItems,
    sampleDrafts,
    sampleConfigs,
    mockElectronEvents,
    testScenarios,
    errorScenarios,
    performanceTestData,
    createRandomHistoryItem,
    createTestDraft,
    createMockWindow
};