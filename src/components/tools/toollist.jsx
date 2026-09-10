import NWmap from '../nwmap.jsx';
import ApplyForJobs from './applyforjobs/index.jsx';
import SatisfactorySink from './satisfactorysink/index.jsx';

export const toollist = [
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
        path: 'satisfactory-sink',
        endpoint: 'tools/satisfactory-sink',
        element: <SatisfactorySink />,
        title: 'Satisfactory Sink Maximizer',
        description: 'Work out what to build from your ore so the AWESOME Sink pays the most.',
        tags: ['Satisfactory', 'Optimizer'],
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
