import React, {useState} from 'react';
import Container from 'react-bootstrap/Container';


const CricketAntenna = (props) => {
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
    <Container onMouseEnter={mouseEnterProjectCard} onMouseLeave={mouseLeaveProjectCard}>
        <h1>Cricket Antenna</h1>
    </Container>
    );
};

export default CricketAntenna;