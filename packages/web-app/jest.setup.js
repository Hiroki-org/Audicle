import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Mock URL APIs
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

// Polyfills for Node environment in Jest
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
