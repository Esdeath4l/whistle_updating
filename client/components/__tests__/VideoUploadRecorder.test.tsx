import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
import "@testing-library/jest-dom";
import VideoUploadRecorder, { VideoFile } from "../VideoUploadRecorder";

// Mock browser APIs
const mockGetUserMedia = vi.fn();
const mockMediaRecorder = vi.fn();

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      getUserMedia: mockGetUserMedia,
    },
    writable: true,
  });

  // Mock MediaRecorder
  global.MediaRecorder = mockMediaRecorder as any;

  // Mock permissions API
  Object.defineProperty(global.navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "granted" }),
    },
    writable: true,
  });

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn().mockReturnValue("mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("VideoUploadRecorder", () => {
  const mockOnVideoChange = vi.fn();

  it("renders upload and record tabs", () => {
    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    expect(screen.getByText("Upload Video")).toBeInTheDocument();
    expect(screen.getByText("Record Video")).toBeInTheDocument();
  });

  it("displays configuration limits in badges", () => {
    render(
      <VideoUploadRecorder
        onVideoChange={mockOnVideoChange}
        config={{ maxSizeMB: 50, maxDurationMinutes: 3 }}
      />,
    );

    expect(screen.getByText("Max 50MB")).toBeInTheDocument();
    expect(screen.getByText("Max 3min")).toBeInTheDocument();
  });

  it("validates video file size", async () => {
    const mockFile = new File(["test"], "test.mp4", {
      type: "video/mp4",
    });
    // Mock file size to be 1200MB (over 1000MB limit)
    Object.defineProperty(mockFile, "size", { value: 1200 * 1024 * 1024 });

    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    const fileInput = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Video must be smaller than 1000MB/),
      ).toBeInTheDocument();
    });
  });

  it("validates video file format", async () => {
    const mockFile = new File(["test"], "test.avi", {
      type: "video/avi",
    });

    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    const fileInput = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Unsupported format/)).toBeInTheDocument();
    });
  });

  it("handles successful file upload", async () => {
    const mockFile = new File(["test"], "test.mp4", {
      type: "video/mp4",
    });
    Object.defineProperty(mockFile, "size", { value: 10 * 1024 * 1024 }); // 10MB

    // Mock video element for duration check
    const mockVideo = {
      duration: 60, // 1 minute
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockVideo as any);

    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    const fileInput = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Simulate video metadata loaded
    const onloadedmetadata = mockVideo.addEventListener.mock.calls.find(
      (call) => call[0] === "onloadedmetadata",
    )?.[1];
    if (onloadedmetadata) {
      onloadedmetadata();
    }

    await waitFor(() => {
      expect(mockOnVideoChange).toHaveBeenCalledWith(
        expect.objectContaining({
          file: mockFile,
          duration: 60,
          format: "video/mp4",
          isRecorded: false,
        }),
      );
    });
  });

  it("displays camera permission request", () => {
    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    // Click on record tab
    fireEvent.click(screen.getByText("Record Video"));

    expect(screen.getByText("Enable Camera")).toBeInTheDocument();
  });

  it("shows recording controls when camera is available", async () => {
    mockGetUserMedia.mockResolvedValue(new MediaStream());

    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    // Click on record tab
    fireEvent.click(screen.getByText("Record Video"));

    // Click enable camera
    fireEvent.click(screen.getByText("Enable Camera"));

    await waitFor(() => {
      expect(screen.getByText("Start Recording")).toBeInTheDocument();
    });
  });

  it("can remove uploaded video", async () => {
    const mockFile = new File(["test"], "test.mp4", { type: "video/mp4" });
    Object.defineProperty(mockFile, "size", { value: 10 * 1024 * 1024 });

    const mockVideo = {
      duration: 60,
      addEventListener: vi.fn((event, callback) => {
        if (event === "loadedmetadata") {
          setTimeout(callback, 0);
        }
      }),
      removeEventListener: vi.fn(),
    };

    vi.spyOn(document, "createElement").mockReturnValue(mockVideo as any);

    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} />);

    const fileInput = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(screen.getByText("test.mp4")).toBeInTheDocument();
    });

    // Remove the video
    const removeButton = screen.getByRole("button", { name: /remove/i });
    fireEvent.click(removeButton);

    expect(mockOnVideoChange).toHaveBeenCalledWith(null);
  });

  it("respects disabled state", () => {
    render(<VideoUploadRecorder onVideoChange={mockOnVideoChange} disabled />);

    const uploadTab = screen.getByText("Upload Video");
    const recordTab = screen.getByText("Record Video");

    expect(uploadTab.closest("button")).toBeDisabled();
    expect(recordTab.closest("button")).toBeDisabled();
  });
});
