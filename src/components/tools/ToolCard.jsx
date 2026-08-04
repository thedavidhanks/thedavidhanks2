import React from 'react';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router-dom';

const TagBox = ({ tagname }) => (
    <span className="tagbox">{tagname}</span>
);

const ToolCard = ({ id, title, description, tags, endpoint, style }) => (
    <Link to={`/${endpoint}`} style={{ color: '#000' }}>
        <Card key={id} style={style}>
            <Card.Body>
                <Card.Title>{title}</Card.Title>
                <Card.Text>{description}</Card.Text>
            </Card.Body>
            {tags && tags.length > 0 && (
                <Card.Footer>
                    {tags.map((tag, i) => <TagBox tagname={tag} key={i} />)}
                </Card.Footer>
            )}
        </Card>
    </Link>
);

export default ToolCard;
