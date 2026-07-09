const messagesEl = document.getElementById('messages');
const composerEl = document.getElementById('composer');
const inputEl = document.getElementById('messageInput');

let threadId = localStorage.getItem('react-agent-thread-id');
if (!threadId) {
  threadId = window.crypto?.randomUUID?.() || `thread-${Date.now()}`;
  localStorage.setItem('react-agent-thread-id', threadId);
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function createMessageBubble(sender, text = '', options = {}) {
  const row = document.createElement('div');
  row.className = `message-row ${sender}`;
  row.dataset.sender = sender;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  if (options.streaming) {
    bubble.classList.add('streaming');
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const senderName = document.createElement('div');
  senderName.className = 'message-sender';
  senderName.textContent = sender === 'user' ? 'You' : 'Assistant';

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = formatTime();

  const body = document.createElement('div');
  body.className = 'message-text';
  body.textContent = text;

  meta.appendChild(senderName);
  meta.appendChild(time);
  bubble.appendChild(meta);
  bubble.appendChild(body);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { row, bubble, body };
}

function addTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'message-row assistant';
  row.dataset.sender = 'assistant';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const senderName = document.createElement('div');
  senderName.className = 'message-sender';
  senderName.textContent = 'Assistant';

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = formatTime();

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  meta.appendChild(senderName);
  meta.appendChild(time);
  bubble.appendChild(meta);
  bubble.appendChild(indicator);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { row, bubble, indicator };
}

function removeTypingIndicator() {
  const typingRow = messagesEl.querySelector('.message-row.assistant[data-sender="assistant"] .typing-indicator');
  if (typingRow) {
    typingRow.closest('.message-row').remove();
  }
}

function appendToolBadge(bubble, label) {
  const badge = document.createElement('div');
  badge.className = 'tool-badge';
  badge.innerHTML = `<span class="dot"></span><span>${label}</span>`;
  bubble.appendChild(badge);
}

function renderSources(container, sources) {
  if (!sources || !sources.length) {
    return;
  }

  const existing = container.querySelector('.source-list');
  if (existing) {
    existing.remove();
  }

  const list = document.createElement('div');
  list.className = 'source-list';

  const title = document.createElement('div');
  title.className = 'source-list-title';
  title.textContent = 'Sources';

  const links = document.createElement('div');
  links.className = 'source-links';

  sources.forEach((source) => {
    const link = document.createElement('a');
    link.className = 'source-link';
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title || source.url;
    links.appendChild(link);
  });

  list.appendChild(title);
  list.appendChild(links);
  container.appendChild(list);
}

function renderWelcomeMessage() {
  const welcome = 'Hello! I can search the web for you. Ask me anything.';
  createMessageBubble('assistant', welcome, { streaming: false });
  messagesEl.querySelector('.message-row.assistant .message-bubble').classList.add('welcome');
}

composerEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = inputEl.value.trim();
  if (!message) {
    return;
  }

  createMessageBubble('user', message);
  inputEl.value = '';
  inputEl.disabled = true;
  composerEl.querySelector('.send-btn').disabled = true;

  const typing = addTypingIndicator();
  let assistantBubble = null;
  let assistantText = '';

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, thread_id: threadId }),
    });

    if (!response.ok || !response.body) {
      throw new Error('Unable to connect to the assistant.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const lines = chunk.split('\n');
        let eventName = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            data += line.slice(5).trim();
          }
        }

        if (!data) {
          continue;
        }

        const payload = JSON.parse(data);

        if (eventName === 'token') {
          if (!assistantBubble) {
            removeTypingIndicator();
            assistantBubble = createMessageBubble('assistant', '', { streaming: true });
          }
          assistantText += payload.text || '';
          assistantBubble.body.textContent = assistantText;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else if (eventName === 'tool_start') {
          if (!assistantBubble) {
            removeTypingIndicator();
            assistantBubble = createMessageBubble('assistant', '', { streaming: true });
          }
          appendToolBadge(assistantBubble.bubble, payload.message || 'Searching');
        } else if (eventName === 'tool_end') {
          if (assistantBubble) {
            appendToolBadge(assistantBubble.bubble, payload.message || 'Completed');
            renderSources(assistantBubble.bubble, payload.sources || []);
          }
        } else if (eventName === 'done') {
          if (assistantBubble) {
            assistantBubble.bubble.classList.remove('streaming');
            assistantBubble.body.textContent = payload.message || assistantText;
            renderSources(assistantBubble.bubble, payload.sources || []);
          } else {
            removeTypingIndicator();
            assistantBubble = createMessageBubble('assistant', payload.message || assistantText, { streaming: false });
          }
        } else if (eventName === 'error') {
          removeTypingIndicator();
          assistantBubble = createMessageBubble('assistant', payload.message || 'Something went wrong.');
        }
      }
    }

    const tail = decoder.decode();
    if (tail) {
      buffer += tail;
    }

    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = chunk.split('\n');
      let eventName = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          data += line.slice(5).trim();
        }
      }
      if (!data) {
        continue;
      }
      const payload = JSON.parse(data);
      if (eventName === 'done') {
        if (assistantBubble) {
          assistantBubble.bubble.classList.remove('streaming');
          assistantBubble.body.textContent = payload.message || assistantText;
        } else {
          removeTypingIndicator();
          createMessageBubble('assistant', payload.message || assistantText, { streaming: false });
        }
      }
    }
  } catch (error) {
    removeTypingIndicator();
    createMessageBubble('assistant', error.message || 'Something went wrong.');
  } finally {
    inputEl.disabled = false;
    composerEl.querySelector('.send-btn').disabled = false;
    inputEl.focus();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  renderWelcomeMessage();
});
