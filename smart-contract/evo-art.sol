pragma solidity ^0.4.0;
contract EvoArt {
    
    struct Artwork {
        GeneticTextureNode root;
        uint[] data;
    }
    
    struct GeneticTextureNode {
        GeneticTextureNode[] children;
        uint _type;
        uint[] data;
    }
    
    address owner;
    mapping(address => bool) admins;
    mapping(address => mapping(address => GeneticTextureNode)) evoArt;
    
    function EvoArt() public {
        owner = msg.sender;
    }
    
    function addAdmin(address adminAddress) public {
        if (msg.sender == owner) {
            admins[adminAddress] = true;
        }
    }
    
    function removeAdmin(address adminAddress) public {
        if (msg.sender == owner) {
            admins[adminAddress] = false;
        }
    }
    
    function isAdmin() private constant returns (bool _isAdmin) {
        return admins[msg.sender] || msg.sender == owner;
    }
    
    function addArt(uint[] art) public {
        if (!isAdmin()) {
            return;
        }
        
        
        GeneticTextureNode[] rootChildren;
        uint[] rootData;
        var root = GeneticTextureNode(rootChildren, 0, rootData);
        
        uint[] artworkData;
        var artwork = Artwork(root, artworkData);
    }
}