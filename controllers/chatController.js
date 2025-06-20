import Message from '../models/Message.js';

// Send message (DB save only; socket sends in real-time)
export const sendMessage = async (req, res) => {
    const {content, receiver, roomId, isPrivate} = req.body;

    try{
        const message = await Message.create({
            sender: req.user.id,
            receiver,
            roomId,
            content,
            isPrivate,
        });

        res.status(201).json(message);
    } catch(err) {
        res.status(500).json({message: 'Fsiled to send message'});
    }
};

//Fetch messages by room or private
export const fetchMessages = async (req, res) => {
    const {roomId, userId} = req.query;

    try{ 
        let messages;

        if(roomId) {
            messages = await Message.find({roomId});
        } else if(userId) {
            messages = await Message.find({
                $or: [
                    {sender: req.user.id, receiver: userId},
                    {sender: userId, receiver: req.user.id},
                ],  
                isPrivate: true,
            });
        }
        
        res.status(200).json(messages);
    } catch(err) {
        res.status(500).json({message: 'Failed to fetch messages'});
    }
};