import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock MediaStream and related APIs
class MockMediaStream {
  constructor() {
    // Mock implementation
  }

  getTracks() {
    return [];
  }

  getVideoTracks() {
    return [];
  }

  getAudioTracks() {
    return [];
  }

  addTrack() {
    // Mock implementation
  }

  removeTrack() {
    // Mock implementation
  }

  addEventListener() {
    // Mock implementation
  }

  removeEventListener() {
    // Mock implementation
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  state: string;
  ondataavailable: ((e?: any) => void) | null;
  onstop: ((e?: any) => void) | null;
  onstart: ((e?: any) => void) | null;

  static isTypeSupported() {
    return true;
  }

  constructor() {
    this.state = "inactive";
    this.ondataavailable = null;
    this.onstop = null;
    this.onstart = null;
  }

  start() {
    this.state = "recording";
    if (this.onstart) this.onstart();
  }

  stop() {
    this.state = "inactive";
    if (this.onstop) this.onstop();
  }

  addEventListener() {
    // Mock implementation
  }

  removeEventListener() {
    // Mock implementation
  }
}

// Set up global mocks
global.MediaStream = MockMediaStream as any;
global.MediaRecorder = MockMediaRecorder as any;

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

// Mock navigator.permissions with proper event handling
Object.defineProperty(global.navigator, "permissions", {
  value: {
    query: vi.fn().mockResolvedValue({
      state: "prompt",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  },
  writable: true,
});

// Mock URL methods
global.URL.createObjectURL = vi.fn().mockReturnValue("mock-url");
global.URL.revokeObjectURL = vi.fn();

// Mock ResizeObserver (often needed for UI components)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver (often needed for UI components)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Enhanced document.createElement mock to return proper DOM elements
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
  if (tagName === "video") {
    const element = originalCreateElement("video");
    // Add common video properties
    Object.defineProperties(element, {
      duration: { value: 60, writable: true },
      currentTime: { value: 0, writable: true },
      paused: { value: true, writable: true },
      muted: { value: false, writable: true },
      volume: { value: 1, writable: true },
      src: { value: "", writable: true },
    });

    // Mock the onloadedmetadata behavior to trigger immediately
    let _onloadedmetadata: (() => void) | null = null;
    Object.defineProperty(element, "onloadedmetadata", {
      get: () => _onloadedmetadata,
      set: (handler: (() => void) | null) => {
        _onloadedmetadata = handler;
        // Trigger the handler immediately in next tick to simulate metadata loading
        if (handler) {
          setTimeout(() => handler(), 0);
        }
      },
    });

    return element;
  }
  return originalCreateElement(tagName);
});
