import React from 'react';
import CardGroup from 'react-bootstrap/CardGroup';
import { Routes, Route } from 'react-router-dom';

import ToolCard from './ToolCard.jsx';
import RequireAuth from './RequireAuth.jsx';
import styles from '../projects/styles.js';
import { toollist } from './toollist.jsx';

const toolCardStyle = styles.projectCard;

const CardContainer = ({ tools }) => (
    <CardGroup>
        {tools.map((tool, i) => (
            <ToolCard
                key={i}
                id={i}
                title={tool.title}
                description={tool.description}
                tags={tool.tags}
                endpoint={tool.endpoint}
                style={toolCardStyle}
            />
        ))}
    </CardGroup>
);

const ToolHome = ({ user, login }) => {
    const toolRoutes = toollist.map((tool, i) => {
        const element = tool.requireAuth
            ? <RequireAuth user={user} login={login}>{tool.element}</RequireAuth>
            : tool.element;
        return <Route key={i} path={tool.path} element={element} />;
    });

    // The card grid only advertises tools the visitor can actually use, so
    // auth-gated tools stay hidden until someone logs in. Routes are still
    // built from the full toollist above, so a direct link to a gated tool
    // renders the RequireAuth login prompt rather than a 404.
    const visibleTools = toollist.filter((tool) => user || !tool.requireAuth);

    return (
        <Routes>
            <Route path="/" element={<CardContainer tools={visibleTools} />} />
            {toolRoutes}
        </Routes>
    );
};

export default ToolHome;
