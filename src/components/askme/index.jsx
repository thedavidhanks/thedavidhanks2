import React, { useState, useRef, useEffect } from 'react';

const API_URL = 'https://6oyuu5k3l1.execute-api.us-east-1.amazonaws.com/Prod/ask';
const API_KEY = import.meta.env.VITE_AWS_SKILLS_API_KEY;

const AskMe = () => {
    const [question, setQuestion] = useState('');
    const [displayedAnswer, setDisplayedAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const intervalRef = useRef(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const typeAnswer = (fullText) => {
        let i = 0;
        setDisplayedAnswer('');
        intervalRef.current = setInterval(() => {
            i++;
            setDisplayedAnswer(fullText.slice(0, i));
            if (i >= fullText.length) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }, 20);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        setLoading(true);
        setDisplayedAnswer('');
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
                body: JSON.stringify({ question: question }),
            });

            if (!response.ok) {
                throw new Error(`Request failed (${response.status})`);
            }

            const data = await response.json();
            const answer = data.answer || data.body || JSON.stringify(data);
            setLoading(false);
            typeAnswer(answer);
        } catch (err) {
            setLoading(false);
            setError('Something went wrong. Please try again.');
        }
    };

    return (
        <div className="resume" style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <h3>Ask Me Anything</h3>
                <p style={{ color: '#666' }}>
                    Ask about David's professional skills, experience, and expertise.
                </p>
            </div>

            <form onSubmit={handleSubmit} style={{ marginBottom: 30 }}>
                <div className="input-group">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="I can help you build that. What skills can I bring to your group?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        disabled={loading}
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

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {(displayedAnswer || loading) && (
                <div
                    style={{
                        background: '#f8f9fa',
                        borderRadius: 8,
                        padding: 24,
                        minHeight: 80,
                        fontSize: '1.05em',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {loading && !displayedAnswer && (
                        <span style={{ color: '#999' }}>Thinking...</span>
                    )}
                    {displayedAnswer}
                    {displayedAnswer && intervalRef.current && (
                        <span style={{ borderRight: '2px solid #333', animation: 'blink 1s step-end infinite' }}>
                            &nbsp;
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default AskMe;
