import React, { useState } from 'react';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router-dom';


const ProjectCard = (props) => {
    //TODO: add background image and default
    // on hover, if an image is available show the background image 
    // and hide the body text.
    // <Card.Img src="holder.js/100px270" alt="Card image" />
    // or
    // <Card bg="info"
    return(
    <Link to={props.endpoint} style={{ color: '#000' }}>
    {props.imgsrc? <CardWithImageOverlay {...props} key={props.id}/>:<CardNoOverlay {...props} key={props.id}/>}
    </Link>
)};
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
    <Card onMouseEnter={mouseEnterProjectCard} onMouseLeave={mouseLeaveProjectCard} key={props.id} style={props.style}>
        <Card.Img src={props.imgsrc} alt="Card image" style={{opacity: imgOpacity}} key={props.id}/>
        <Card.ImgOverlay key={'cardimgover'+props.id}>
            <Card.Title key={'cardtitle'+props.id}>{props.title}</Card.Title>
            {showText?<Card.Subtitle className="mb-2 text-muted" key={'cardsub'+props.id}>{props.sub}</Card.Subtitle>:null}
            {showText?
            <Card.Text key={'cardtext'+props.id}>
                {props.children}
            </Card.Text>:
            null}
        </Card.ImgOverlay>
        <Card.Footer key={'footer'+props.id}>
            {props.tags.map( (tag, index) => (
                <TagBox tagname={tag} key={index} />
            ))}
        </Card.Footer>
    </Card>
    );
};

const CardNoOverlay = (props) => (
    <Card bg={props.bg} key={props.id} style={props.style}>
        <Card.Body>
            <Card.Title key={props.id}>{props.title}</Card.Title>
            <Card.Subtitle key={'cardsub'+props.id} className="mb-2 text-muted">{props.sub}</Card.Subtitle>
            <Card.Text key={'cardtext'+props.id}>
                {props.children}
            </Card.Text>
        </Card.Body>
        <Card.Footer key={'footer'+props.id}>
            {props.tags.map( (tag, index) => (
                <TagBox tagname={tag} key={index} />
            ))}
        </Card.Footer>
    </Card>
);