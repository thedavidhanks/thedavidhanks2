import React from 'react';
import CardGroup from 'react-bootstrap/CardGroup';
import { Routes, Route } from 'react-router-dom';

import NWmap from '../nwmap.jsx';
import ApplyForJobs from './applyforjobs/index.jsx';
import ToolCard from './ToolCard.jsx';
import RequireAuth from './RequireAuth.jsx';
import styles from '../projects/styles.js';

const toolCardStyle = styles.projectCard;

const toollist = [
    {
        path: 'applyforjobs',
        endpoint: 'tools/applyforjobs',
        element: <ApplyForJobs />,
        title: 'Apply for Jobs',
        description: 'Paste a job posting; get a tailored cover letter and resume.',
        tags: ['AI', 'Bedrock'],
        requireAuth: true,
    },
    {
        path: 'nwmap',
        endpoint: 'tools/nwmap',
        element: <NWmap />,
        title: 'New World Map',
        description: 'Interactive map for the New World MMO.',
        tags: ['Map'],
    },
];

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
