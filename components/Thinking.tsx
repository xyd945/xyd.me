'use client';
import { useState, useEffect } from 'react';

const thinkingMessages = [
  'I need to take a cup of coffee before I look at the questions...',
  'Consulting the archives...',
  'Reticulating splines...',
  'Asking the squirrels for their opinion...',
  'Dusting off the old encyclopedia...',
  'One moment, just finishing a game of Pong...',
];

export const Thinking: React.FC = () => {
  const [ellipsis, setEllipsis] = useState('.');
  const [randomMessage, setRandomMessage] = useState('');

  useEffect(() => {
    setRandomMessage(thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)]);

    const interval = setInterval(() => {
      setEllipsis(prev => {
        if (prev === '...') return '.';
        return prev + '.';
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <span className="text-theme-accent">kitt@xyd.me:</span>
      <span className="text-theme-secondary">$ ~ </span>
      <span className="whitespace-pre-wrap">
        {randomMessage}{ellipsis}
      </span>
    </div>
  );
};
