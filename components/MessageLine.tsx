import React from 'react';

interface MessageLineProps {
  role: 'user' | 'assistant';
  content: string;
}

export const MessageLine: React.FC<MessageLineProps> = ({ role, content }) => {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div>
        <span className="text-theme-primary">visitor@xyd.me:</span>
        <span className="text-theme-secondary">$ ~ </span>
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap text-theme-text">
      {content}
    </div>
  );
};