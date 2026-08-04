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

    return (
        <Routes>
            <Route path="/" element={<CardContainer tools={toollist} />} />
            {toolRoutes}
        </Routes>
    );
};

export default ToolHome;
