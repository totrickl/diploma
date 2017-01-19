var fs = require('fs');
var _ = require('lodash');
var util = require('util');
var async = require('async');
var COORDINATES = require('./coordinates');
// console.log("LENGTH",coordinates.length);
/**
 * cost - сколько стоит вариант топологии
 * robustness - количетсвенный показатель надежности варианта топологии
 * operativeness - количетсвенный показатель оперативности варианта топологии
 * vitality - количетсвенный показатель живучести варианта топологии
 */

var ELEMENT_COST = 20000,
    NODE_COST = 50000,
    CENTRE_COST = 110000,
    ELEMENT_NODE_REL_COST = 1500,
    CENTRE_ELEMENT_REL_COST = 5000,
    CENTRE_NODE_REL_COST = 4500;

var ELEMENTS = [];


var Topology = function (elementsToAddToTopology, nodesNumber) {
    var self = this;
    this.id = parseInt(Math.random().toString().slice(3, 7));
    this.center = null;
    this.centerElementConnections = [];
    var cost = null;
    this.robustness = null;
    this.operativeness = null;
    this.vitality = null;
    var elements = [];
    var nodes = [];

    var __constr = function () {
        setCenter(elementsToAddToTopology[0], function () {
            setElements(function () {
                setNodes(nodesNumber, function () {
                    setTopologyCost()
                })
            })
        })
    };

    var setNodes = function (nodesNumber, next) {
        var nodesCount = 0;
        var r = _.sample(elements);
        // console.log("sdadsa",r);
        _.each(elements, function () {
            while (nodesCount < nodesNumber) {
                nodes.push(new Node(r));
                var filter = _.filter(elements, function (fElement) {
                    return fElement.id == r.id
                });
                // console.log("removing elm №"+filter[0].id, filter);
                self.unsetElement(filter[0]);
                nodesCount++;
            }
        });
        next();
    };

    this.setNode = function (nodeToSet) {
        nodes.push(nodeToSet);
    };

    this.setNodeOnElementBase = function (tEl) {
        nodes.push(new Node(tEl));
    };

    this.unsetNode = function (nodeToUnset) {
        nodeToUnset.disconnectElements(nodeToUnset.elementsConnected);
        _.pull(nodes, nodeToUnset);
        elements.push(new Element(nodeToUnset))
        return self;
    };


    this.getNodes = function () {
        return nodes;
    };

    var setElements = function (next) {
        elements = _.filter(elementsToAddToTopology, function (element) {
            return element.id != self.center.id;
        });
        next();
    };
    this.getElements = function () {
        return elements;
    };
    this.unsetElement = function (elementToUnset) {
        _.pull(elements, elementToUnset);
    };

    var setCenter = function (centre, next) {
        self.center = centre;
        next()
    };

    this.getCentre = function () {
        return self.center;
    };

    this.generateGraph = function () {
        var tNodes = self.getNodes();
        var tElements = self.getElements();
        var minCost = 0;
        for (var n = 0; n < tNodes.length; n++) {
            for (var e = 0; e < tElements.length; e++) {
                var currElementToNodeConnectionCost = tElements[e].calculateCost(tNodes[n], tElements[e]);
                var centerElementConnection = tElements[e].calculateCost(tElements[e], self.center);
                var nextNodeElementToNodeConnectionCost = tElements[e + 1].calculateCost(tNodes[n], tElements[e + 1]);
                // console.log("подключение центру дешевле чем к узлу? - ", centreElementConnection < currElementToNodeConnectionCost);
                if (centerElementConnection < currElementToNodeConnectionCost) {
                    self.centerElementConnections.push(tElements[e]);
                }
                // console.log("current", currElementToNodeConnectionCost);
                // console.log("next", tElements[e + 1].id);
                if (nextNodeElementToNodeConnectionCost < currElementToNodeConnectionCost && !self.centerElementConnections[tElements[e + 1].id]) {
                    minCost = nextNodeElementToNodeConnectionCost;
                    tNodes[n].connectElement(tElements[e + 1]);
                    tElements[e + 1].setNodeId(tNodes[n].id);
                } else {
                    minCost = currElementToNodeConnectionCost;
                    tNodes[n].connectElement(tElements[e]);
                    tElements[e].setNodeId(tNodes[n].id);
                    break;
                }

            }
        }
        setTopologyCost();
        return self;
    };

    // this.rearrangeGraph = function (node) {
    //     var minCost = self.getTopologyCost();
    //     self.generateGraph();
    //     if(self.getTopologyCost() < minCost){
    //         self.unsetNode(node);
    //
    //     }
    //
    // };

    var setTopologyCost = function () {
        var costWithoutRelations = (ELEMENT_COST * elements.length) + (NODE_COST * nodes.length) + CENTRE_COST;
        // console.log("стоимость элементов сети", costWithoutRelations);
        var centerConnsCount = self.centerElementConnections.length;
        var nodesCount = nodes.length;
        var centerNodesCost = 0;
        var centerElementsCost = 0;
        var nodesElementsCost = 0;
        for (var n = 0; n < nodes.length; n++) {
            // console.log("центр к узлам", centerNodesCost);
            centerNodesCost += nodes[n].calculateCost(self.center, nodes[n])
        }
        for (var ce = 0; ce < self.centerElementConnections.length; ce++) {
            // console.log("элементы к центру", centerElementsCost);
            centerElementsCost += self.centerElementConnections[ce].calculateCost(self.center, self.centerElementConnections[ce])
        }
        for (var ne = 0; ne < nodes.length; ne++) {
            for (var e = 0; e < nodes[ne].elementsConnected.length; e++) {
                // console.log("элементы к узлам", nodesElementsCost);
                nodesElementsCost += nodes[ne].calculateElementNodeCost(nodes[ne], nodes[ne].elementsConnected[e]);
            }
        }
        if (!_.isEmpty(self.centerElementConnections)) {
            cost = costWithoutRelations + centerNodesCost + centerElementsCost + nodesElementsCost;
        } else {
            cost = costWithoutRelations + centerNodesCost + nodesElementsCost;
        }
    };

    this.getElementById = function (id) {
        return _.filter(elements, function (element) {
            return element.id == id;
        });
    };

    this.getTopologyCost = function () {
        return cost;
    };

    __constr();
    return this;
};
var Element = function (coordinates) {
    this.id = parseInt(Math.random().toString().slice(3, 10));
    this.x = coordinates.x;
    this.y = coordinates.y;
    var nodeId = null;

    this.calculateDistance = function (firstPoint, secondPoint) {
        return Math.sqrt(Math.pow((secondPoint.x - firstPoint.x), 2) + (Math.pow((secondPoint.y - firstPoint.y), 2)));
    };

    this.calculateCost = function (firstPoint, secondPoint) {
        // console.log("point 1 - ", firstPoint);
        // console.log("point 2 - ", secondPoint);
        return this.calculateDistance(firstPoint, secondPoint) * CENTRE_ELEMENT_REL_COST;
    };

    this.setNodeId = function (id) {
        nodeId = id;
    };

    this.getNodeId = function () {
        return nodeId;
    };

    return this;
};
var Node = function (coordinates) {
    var self = this;
    this.id = parseInt(Math.random().toString().slice(3, 10));
    this.x = coordinates.x;
    this.y = coordinates.y;
    this.elementsConnected = [];
    this.elementsConnectedCount = 0;

    this.calculateDistance = function (firstPoint, secondPoint) {
        return Math.sqrt(Math.pow((secondPoint.x - firstPoint.x), 2) + (Math.pow((secondPoint.y - firstPoint.y), 2)));
    };
    this.calculateCost = function (firstPoint, secondPoint) {
        return this.calculateDistance(firstPoint, secondPoint) * CENTRE_NODE_REL_COST;
    };
    this.calculateElementNodeCost = function (firstPoint, secondPoint) {
        return this.calculateDistance(firstPoint, secondPoint) * ELEMENT_NODE_REL_COST;
    };

    this.connectElement = function (element) {
        self.elementsConnected.push(element);
        self.elementsConnectedCount += 1;
    };

    this.disconnectElements = function (id) {
        if (_.isArray(id)) {
            _.each(id, function (i) {
                _.pull(self.elementsConnected, self.elementsConnected[id[i]])
            })
        } else {
            _.pull(self.elementsConnected, self.elementsConnected[id]);
        }
    };

    this.disconnectAllElements = function () {
        self.elementsConnected = [];
    };
    this.getConnectionById = function (id) {
        return _.filter(self.elementsConnected, function (element) {
            return element.id == id;
        })
    };

    return self;
};

var main = function () {
    var topology = new Topology(ELEMENTS, 10);
    var graph = topology.generateGraph();
    var xyita = coordDescendingMethod(graph, topology.getNodes())
    // console.log(xyita);
};

function coordDescendingMethod(graph, nodes) {
    var answar = [];
    var topologyCost = graph.getTopologyCost();
    var newGraph = graph.generateGraph();
    for (var n = 0; n < nodes.length; n++) {
        console.log(
            "Iteration #" + "" + n + ": \n", "Topology costs: ", graph.getTopologyCost() + "\n",
            "Nodes count: ", nodes[n].elementsConnectedCount, "-------", newGraph.getTopologyCost()
        );
        if (topologyCost > newGraph.getTopologyCost()) {
            console.log("asdadsadsa");
            topologyCost = newGraph.getTopologyCost();
            graph = newGraph.generateGraph();
        }else{

        }
        newGraph.unsetNode(nodes[n]);
        newGraph.generateGraph();

    }
    return newGraph;
};


function createElements() {
    _.each(COORDINATES, function (coord) {
        ELEMENTS.push(new Element(coord));
    });
}

async.waterfall([
    function (callback) {
        createElements();
        callback();
    },
    function (callback) {
        main();
        callback(null, 'three');
    }
], function (err, result) {
    if (err) {
        console.log('err', err);
    }
    // console.log('Async was finished');
});