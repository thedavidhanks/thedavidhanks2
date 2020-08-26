import React from 'react';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router-dom';

import mimo from './mimo.png';

const ProjectCard = (props) => (
    //TODO: add background image and default
    // on hover, if an image is available show the background image 
    // and hide the body text.
    // <Card.Img src="holder.js/100px270" alt="Card image" />
    // or
    // <Card bg="info"  
    //TODO: add tags -engineering- -software- -java- -woodwork-
    <Link to={props.endpoint} style={{ color: '#000' }}>
    {props.imgsrc? <CardWithImageOverlay {...props} />:<CardNoOverlay {...props}/>}
    </Link>
);
export default ProjectCard;

const TagBox = (props) => (
    <span className="tagbox">
    {props.tagname}      
    </span>
);

const CardWithImageOverlay = (props) => (    
    <Card>
        <Card.Img src={mimo} alt="Card image" />
        <Card.ImgOverlay>
            <Card.Title>{props.title}</Card.Title>
            <Card.Subtitle className="mb-2 text-muted">{props.sub}</Card.Subtitle>
            <Card.Text>
                {props.children}
                {console.log(props.imgsrc)}
            </Card.Text>
        </Card.ImgOverlay>
        <Card.Footer>
            {props.tags.map( (tag) => (
                <TagBox tagname={tag} />
            ))}
        </Card.Footer>
    </Card>
);
const CardNoOverlay = (props) => (
    <Card bg={props.bg}>
        <Card.Body>
            <Card.Title>{props.title}</Card.Title>
            <Card.Subtitle className="mb-2 text-muted">{props.sub}</Card.Subtitle>
            <Card.Text>
                {props.children}
            </Card.Text>
        </Card.Body>
        <Card.Footer>
            {props.tags.map( (tag) => (
                <TagBox tagname={tag} />
            ))}
        </Card.Footer>
    </Card>
);