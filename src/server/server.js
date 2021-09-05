const FlightSuretyApp = require('../../build/contracts/FlightSuretyApp.json');
const FlightSuretyData = require('../../build/contracts/FlightSuretyData.json');
const Config = require('./config.json');
const Web3 = require('web3');
const express = require('express');


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
const oracles = new Map();
let accounts = [];
const statuses = [20, 0, 10, 30, 40, 50];

const registerInitialOracles = async () => {
    try {
        accounts = await getAccounts();
        console.log(accounts);
        for (let i = 10; i < 30; i++) {
            await registerOracle(accounts[i]);
            let indexes = await getOracleIndexes(accounts[i]);
            oracles.set(accounts[i], indexes);
            console.log(`Registered Oracle: ${accounts[i]} with ${indexes}`);
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
    for (let [address, indexes] of oracles) {
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

const fundAirline = () =>{
    return new Promise((resolve, reject) => {
        flightSuretyApp.methods.fund().send({from: accounts[0], value: web3.utils.toWei('10', 'ether'), gas: 500000}, (error, result) =>{
            if(error){
                console.log('Unable to fundAirline due to ' + error.message);
                reject(error);
            }
            else {
                resolve(result);
            }
        });
    });
};

const registerFlight = () =>{
    return new Promise((resolve, reject) => {
        flightSuretyApp.methods.registerFlight(flightNumber, 1122334455).send({from: accounts[0], gas: 500000}, (error, result) =>{
            if(error){
                console.log('Unable to registerFlight due to ' + error.message);
                reject(error);
            }
            else {
                resolve(result);
            }
        });
    });
};

const fetchFlightStatus = () =>{
    return new Promise((resolve, reject) => {
        flightSuretyApp.methods.fetchFlightStatus(flightNumber).send({from: accounts[0], gas: 500000}, (error, result) =>{
            if(error){
                console.log('Unable to fetchFlightStatus due to ' + error.message);
                reject(error);
            }
            else {
                resolve(result);
            }
        });
    });
};

flightSuretyApp.events.OracleRequest({fromBlock: 0}, (error, event) => {
    if (error)
        console.log(error);
    else {
        console.log('OracleRequest event received');
        submitOracleResponses(event);
    }
});

flightSuretyApp.events.OracleReport({fromBlock: 0}, (error, event) => {
    if (error)
        console.log(error);
    else
        console.log('OracleReport event received');
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

registerInitialOracles();

module.export = {
    app
}
