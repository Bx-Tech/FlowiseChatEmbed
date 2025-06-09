export const isNotDefined = <T>(value: T | undefined | null): value is undefined | null => value === undefined || value === null;

export const isDefined = <T>(value: T | undefined | null): value is NonNullable<T> => value !== undefined && value !== null;

export const isEmpty = (value: string | undefined | null): value is undefined => value === undefined || value === null || value === '';

export const isNotEmpty = (value: string | undefined | null): value is string => value !== undefined && value !== null && value !== '';

export const sendRequest = async <ResponseData>(
  params:
    | {
        url: string;
        method: string;
        body?: Record<string, unknown> | FormData;
        type?: string;
        headers?: Record<string, any>;
        formData?: FormData;
        onRequest?: (request: RequestInit) => Promise<void>;
      }
    | string,
): Promise<{ data?: ResponseData; error?: Error }> => {
  try {
    const url = typeof params === 'string' ? params : params.url;
    const headers =
      typeof params !== 'string' && isDefined(params.body)
        ? {
            'Content-Type': 'application/json',
            ...params.headers,
          }
        : undefined;
    let body: string | FormData | undefined = typeof params !== 'string' && isDefined(params.body) ? JSON.stringify(params.body) : undefined;
    if (typeof params !== 'string' && params.formData) body = params.formData;

    const requestInfo: RequestInit = {
      method: typeof params === 'string' ? 'GET' : params.method,
      mode: 'cors',
      headers,
      body,
    };

    if (typeof params !== 'string' && params.onRequest) {
      await params.onRequest(requestInfo);
    }

    const response = await fetch(url, requestInfo);

    let data: any;
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (typeof params !== 'string' && params.type === 'blob') {
      data = await response.blob();
    } else {
      data = await response.text();
    }
    if (!response.ok) {
      let errorMessage;

      if (typeof data === 'object' && 'error' in data) {
        errorMessage = data.error;
      } else {
        errorMessage = data || response.statusText;
      }

      throw errorMessage;
    }

    return { data };
  } catch (e) {
    console.error(e);
    return { error: e as Error };
  }
};

export const setLocalStorageChatflow = (chatflowid: string, chatId: string, saveObj: Record<string, any> = {}) => {
  const MAX_HISTORY = 30;
  const MAX_BYTES = 2000;

  const obj = { ...saveObj };
  if (chatId) obj.chatId = chatId;

  // Trim chatHistory and remove heavy fields
  if (Array.isArray(obj.chatHistory)) {
    console.log(`[SAM] chatHistory before trim: ${obj.chatHistory.length}`);
    obj.chatHistory = obj.chatHistory.slice(-MAX_HISTORY).map((msg) => {
      const { agentReasoning, sourceDocuments, artifacts, ...rest } = msg;
      return rest;
    });
    console.log(`[SAM] chatHistory after trim: ${obj.chatHistory.length}`);
  }

  const jsonStr = JSON.stringify(obj);
  const byteSize = new Blob([jsonStr]).size;
  console.log(`[SAM] chatflow state size: ${byteSize} bytes`);

  if (byteSize > MAX_BYTES) {
    console.warn(`[SAM] Skipped saving oversized chatflow state to localStorage (${byteSize} bytes)`);
    return;
  }

  try {
    const chatDetails = localStorage.getItem(`${chatflowid}_EXTERNAL`);
    if (chatDetails) {
      const parsed = JSON.parse(chatDetails);
      const merged = { ...parsed, ...obj };
      if (obj.chatHistory) merged.chatHistory = obj.chatHistory;
      localStorage.setItem(`${chatflowid}_EXTERNAL`, JSON.stringify(merged));
    } else {
      localStorage.setItem(`${chatflowid}_EXTERNAL`, jsonStr);
    }
    console.log(`[SAM] Saved state for ${chatflowid}_EXTERNAL`);
  } catch (e) {
    console.error(`[SAM] Failed to update localStorage:`, e);
    localStorage.setItem(`${chatflowid}_EXTERNAL`, JSON.stringify({ chatId }));
  }
};

export const getLocalStorageChatflow = (chatflowid: string) => {
  const chatDetails = localStorage.getItem(`${chatflowid}_EXTERNAL`);
  if (!chatDetails) return {};
  try {
    return JSON.parse(chatDetails);
  } catch (e) {
    return {};
  }
};

export const removeLocalStorageChatHistory = (chatflowid: string) => {
  const chatDetails = localStorage.getItem(`${chatflowid}_EXTERNAL`);
  if (!chatDetails) return;
  try {
    const parsedChatDetails = JSON.parse(chatDetails);
    if (parsedChatDetails.lead) {
      // Dont remove lead when chat is cleared
      const obj = { lead: parsedChatDetails.lead };
      localStorage.removeItem(`${chatflowid}_EXTERNAL`);
      localStorage.setItem(`${chatflowid}_EXTERNAL`, JSON.stringify(obj));
    } else {
      localStorage.removeItem(`${chatflowid}_EXTERNAL`);
    }
  } catch (e) {
    return;
  }
};

export const getBubbleButtonSize = (size: 'small' | 'medium' | 'large' | number | undefined) => {
  if (!size) return 48;
  if (typeof size === 'number') return size;
  if (size === 'small') return 32;
  if (size === 'medium') return 48;
  if (size === 'large') return 64;
  return 48;
};

export const setCookie = (cname: string, cvalue: string, exdays: number) => {
  const d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  const expires = 'expires=' + d.toUTCString();
  document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
};

export const getCookie = (cname: string): string => {
  const name = cname + '=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
};
