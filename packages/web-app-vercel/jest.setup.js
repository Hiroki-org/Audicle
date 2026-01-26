import "@testing-library/jest-dom";

// React 18: act() を正しく扱うためのフラグ
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// eslint-disable-next-line no-undef
global.IS_REACT_ACT_ENVIRONMENT = true;

// Next.js のグローバル変数をモック
global.Request = class Request {
  constructor(input, init = {}) {
    // URL プロパティを getter として定義
    Object.defineProperty(this, "url", {
      value: typeof input === "string" ? input : input.url,
      writable: false,
      enumerable: true,
    });

    this.method = init?.method || "GET";
    this.headers = new Headers(init?.headers || {});
    this.body = init?.body;
  }

  async json() {
    return JSON.parse(this.body);
  }

  async formData() {
    // FormData のモック
    return this.body instanceof FormData ? this.body : new FormData();
  }
};

global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Headers(init?.headers || {});
    this.redirected = false;
  }

  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  }

  static redirect(url, status = 307) {
    const response = new Response(null, {
      status,
      headers: {
        Location: url instanceof URL ? url.href : url,
      },
    });
    response.redirected = true;
    return response;
  }

  async json() {
    return JSON.parse(this.body);
  }
};

global.Headers = class Headers {
  constructor(init) {
    if (init instanceof Headers) {
      this.map = new Map(init.map);
    } else {
      this.map = new Map(Object.entries(init || {}));
    }
  }

  get(name) {
    // Case-insensitiveな検索
    const lowerName = name.toLowerCase();
    for (const [key, value] of this.map.entries()) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }

  set(name, value) {
    this.map.set(name, value);
  }

  entries() {
    return this.map.entries();
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }

  has(name) {
    const lowerName = name.toLowerCase();
    for (const key of this.map.keys()) {
      if (key.toLowerCase() === lowerName) {
        return true;
      }
    }
    return false;
  }

  delete(name) {
    return this.map.delete(name);
  }

  forEach(callback, thisArg) {
    this.map.forEach(callback, thisArg);
  }
};

import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.BroadcastChannel = class BroadcastChannel {
  constructor(name) {
    this.name = name;
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

// Web Streams API
global.WritableStream = class WritableStream {
  constructor() {
    this.locked = false;
  }
  getWriter() {
    return {
      write: async () => {},
      close: async () => {},
      abort: async () => {},
      releaseLock: () => {},
    };
  }
};

global.ReadableStream = class ReadableStream {
  constructor() {
    this.locked = false;
  }
  getReader() {
    return {
      read: async () => ({ done: true, value: undefined }),
      releaseLock: () => {},
      cancel: async () => {},
    };
  }
};

global.TransformStream = class TransformStream {
  constructor() {
    this.readable = new ReadableStream();
    this.writable = new WritableStream();
  }
};

// URL.createObjectURL のモック（ブラウザAPI）
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();
