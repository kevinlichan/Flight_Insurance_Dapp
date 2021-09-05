const FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json');
const Config = require('./config.json');
const Web3 = require('web3');
const express = require('express');


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);


const oraclesMap = new Map();
let accounts = [];
const statuses = [20, 0, 10, 30, 40, 50];

const initializeOracles = async () => {
    try {
        accounts = await getAccounts();
        console.log(accounts);
        for (let a = 10; a < 30; a++) {
            await registerOracle(accounts[a]);
            let indexes = await getOracleIndexes(accounts[a]);
            oraclesMap.set(accounts[a], indexes);
            console.log(`Registered Oracle: ${accounts[a]} with ${indexes}`);
        }
    } catch (error){
        console.log(error);
    };
};

const getAccounts = () => {
    return new Promise((resolve, reject) => {
        web3.eth.getAccounts((error, result) => {
            if (error) {
                console.error('Error encountered while getting accounts');
                reject(error);
            } else {
              resolve(result);
            }
        });
    });
};

const registerOracle = (address) => {
    return new Promise((resolve, reject) => {
        flightSuretyApp.methods.registerOracle().send({from: address, value: web3.utils.toWei('1', 'ether'), gas: 3000000}, (error, result) => {
            if (error) {
                reject(error)
            } else {
                resolve(result)
            }
        });
    });
};

const getOracleIndexes = (address) => {
    return new Promise((resolve, reject) => {
        flightSuretyApp.methods.getMyIndexes().call({from: address, gas: 1000000}, (error, result) => {
            if(!error){
                resolve(result);
            } else {
                reject(error);
            }
        });
    });
};

const submitOracleResponses = async(event) =>{
    const oraclesByIndex = getOraclesByIndex(event.returnValues.index);
    oraclesByIndex.forEach(async(oracleAddress) => {
        try {
            await submitOracleResponse(oracleAddress, event.returnValues.index, event.returnValues.airline, event.returnValues.flightNumber, event.returnValues.timestamp);
        } catch(error){
            console.log(error);
        }
    });
};

const getOraclesByIndex = (desiredIndex) => {
    let matchingOracles = [];
    for (let [address, indexes] of oraclesMap) {
        indexes.forEach(index => {
            if (index == desiredIndex) {
                matchingOracles.push(address);
                console.log(desiredIndex + '->' + address);
            }
        });
    }
    return matchingOracles;
};

const submitOracleResponse = (oracleAddress, index, airline, flightNumber, timestamp) => {
    return new Promise((resolve, reject) => {
        let statusCode = flightStatusCodeGenerator();
        console.log(`Oracle ${oracleAddress} is submitting flight status code of ${statusCode}`);
        flightSuretyApp.methods.submitOracleResponse(index, airline, flightNumber, timestamp, statusCode)
            .send({from: oracleAddress, gas: 1000000000},
                (error, result) => {
                    if(!error)
                        resolve(result);
                    else {
                        console.log(error);
                        reject(error);
                    }
            });
    });
};

const flightStatusCodeGenerator = () =>{
    let randomNumber = Math.floor(Math.random() * 6);
    if (randomNumber == 6)
        return statuses[0];
    else {
        return statuses[(randomNumber*10)];
    }
};

flightSuretyApp.events.OracleRequest({fromBlock: 0}, (error, event) => {
    if (error)
        console.log(error);
    else {
        submitOracleResponses(event);
    }
});

flightSuretyApp.events.OracleReport({fromBlock: 0}, (error, event) => {
    if (error)
        console.log(error);
    else
        console.log('OracleReport received');
});

flightSuretyApp.events.FlightStatusInfo({fromBlock: 0}, (error, event) => {
    if (error)
        console.log(error);
    else {
        console.log(`${event.event} Received with attributes :
            airline ${event.returnValues.airline}
            flightNumber ${web3.utils.toUtf8(event.returnValues.flightNumber)}
            timeStamp ${Number(event.returnValues.timestamp)}
            statusCode : ${event.returnValues.status}
        `);
    }
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
});

initializeOracles();

module.export = {
    app
}
