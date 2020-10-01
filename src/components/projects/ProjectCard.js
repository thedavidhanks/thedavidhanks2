import React, { useState } from 'react';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router-dom';


const ProjectCard = (props) => (
    //TODO: add background image and default
    // on hover, if an image is available show the background image 
    // and hide the body text.
    // <Card.Img src="holder.js/100px270" alt="Card image" />
    // or
    // <Card bg="info"
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

const CardWithImageOverlay = (props) => {
    const [showText, setShowText] = useState(true);
    const [imgOpacity, setImgOpacity] = useState(0.4);
    
    const mouseEnterProjectCard = () => {
        setImgOpacity(1);
        setShowText(false);
    };
    const mouseLeaveProjectCard = () => {
        setImgOpacity(0.4);
        setShowText(true);
    };
    
    return(
    <Card onMouseEnter={mouseEnterProjectCard} onMouseLeave={mouseLeaveProjectCard}>
        <Card.Img src={props.imgsrc} alt="Card image" style={{opacity: imgOpacity}}/>
        <Card.ImgOverlay>
            <Card.Title>{props.title}</Card.Title>
            {showText?<Card.Subtitle className="mb-2 text-muted">{props.sub}</Card.Subtitle>:null}
            {showText?
            <Card.Text>
                {props.children}
            </Card.Text>:
            null}
        </Card.ImgOverlay>
        <Card.Footer>
            {props.tags.map( (tag) => (
                <TagBox tagname={tag} />
            ))}
        </Card.Footer>
    </Card>
    );
};

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