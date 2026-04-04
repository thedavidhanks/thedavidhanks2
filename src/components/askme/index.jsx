import React, { useState, useRef, useEffect } from 'react';
import './askme.css';

const API_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask';
const API_KEY = import.meta.env.VITE_AWS_SKILLS_API_KEY;

const bubbleBase = {
    borderRadius: 12,
    padding: '10px 16px',
    marginBottom: 12,
    maxWidth: '80%',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
};

const userBubbleStyle = {
    ...bubbleBase,
    background: '#0b93f6',
    color: '#fff',
    marginLeft: 'auto',
    borderBottomRightRadius: 4,
};

const answerBubbleStyle = {
    ...bubbleBase,
    background: '#e5e5ea',
    color: '#000',
    marginRight: 'auto',
    borderBottomLeftRadius: 4,
};

const AskMe = () => {
    const [question, setQuestion] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [typingText, setTypingText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const intervalRef = useRef(null);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingText]);

    const typeAnswer = (fullText) => {
        let i = 0;
        setTypingText('');
        intervalRef.current = setInterval(() => {
            i++;
            setTypingText(fullText.slice(0, i));
            if (i >= fullText.length) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setTypingText('');
                setMessages((prev) => [...prev, { role: 'answer', text: fullText }]);
            }
        }, 20);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const q = question.trim();
        if (!q) return;

        setMessages((prev) => [...prev, { role: 'user', text: q }]);
        setQuestion('');
        setLoading(true);
        inputRef.current?.focus();
        setTypingText('');
        setError('');

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': API_KEY,
                },
                body: JSON.stringify({ question: q, ...(sessionId && { sessionId }) }),
            });

            if (!response.ok) {
                throw new Error(`Request failed (${response.status})`);
            }

            const data = await response.json();
            if (data.sessionId) setSessionId(data.sessionId);
            const answer = data.answer || data.body || JSON.stringify(data);
            setLoading(false);
            typeAnswer(answer);
        } catch (err) {
            setLoading(false);
            setError('Something went wrong. Please try again.');
        }
    };

    const hasMessages = messages.length > 0 || typingText || loading;

    return (
        <div className="resume askme-container" style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '80vh' }}>
            {!hasMessages && (
                <div style={{ textAlign: 'center', marginBottom: 30, marginTop: 60 }}>
                    <h3>Ask Me Anything</h3>
                    <p style={{ color: '#666' }}>
                        Ask about David's professional skills, experience, and expertise.
                    </p>
                </div>
            )}

            {hasMessages && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={msg.role === 'user' ? userBubbleStyle : answerBubbleStyle}
                        >
                            {msg.text}
                        </div>
                    ))}

                    {loading && !typingText && (
                        <div style={answerBubbleStyle}>
                            <span style={{ color: '#999' }}>Thinking...</span>
                        </div>
                    )}

                    {typingText && (
                        <div style={answerBubbleStyle}>
                            {typingText}
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>
            )}

            {error && (
                <div className="alert alert-danger" role="alert" style={{ marginBottom: 10 }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ marginTop: hasMessages ? 'auto' : 0, paddingTop: 10 }}>
                <div className="input-group">
                    <input
                        ref={inputRef}
                        type="text"
                        className="form-control"
                        placeholder="I can help you build that. What skills can I bring to your group?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                    />
                    <button
                        className="btn btn-outline-primary"
                        type="submit"
                        disabled={loading || !question.trim()}
                    >
                        {loading ? 'Thinking...' : 'Ask'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AskMe;
