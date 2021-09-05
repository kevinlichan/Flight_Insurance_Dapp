App = {
    web3Provider: null,
    contracts: {},

    init: async () => {
        return await App.initWeb3();
    },

    initWeb3: async () => {
        /// Find or Inject Web3 Provider
        /// Modern dapp browsers...
        if (window.ethereum) {
            App.web3Provider = window.ethereum;
            try {
                // Request account access
                await window.ethereum.enable();
            } catch(error) {
                // User denied account access...
                console.error("User denied account access");
            }
        }
        // Legacy dapp browsers...
        else if (window.web3) {
            App.web3Provider = window.web3.currentProvider;
        }
        // If no injected web3 instance is detected, fall back to Ganache
        else {
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
            console.log('Using localhost ganache as provider!');
        }

        App.getMetaskAccountID();

        return App.initContracts();
    },

    getMetaskAccountID: function () {
        web3 = new Web3(App.web3Provider);

        // Retrieving accounts
        web3.eth.getAccounts(function(err, res) {
            if (err) {
                console.log('Error:',err);
                return;
            }
            App.metamaskAccountID = res[0];

        })
    },

    initContracts: async() => {
        /// Source the truffle compiled smart contracts
        var jsonAppContract ='../../build/contracts/FlightSuretyApp.json';
        var jsonDataContract ='../../build/contracts/FlightSuretyData.json';

        /// JSONfy the smart contracts
        $.getJSON(jsonDataContract, (data) => {
            var ContractArtifact = data;
            App.contracts.DataContract = TruffleContract(ContractArtifact);
            App.contracts.DataContract.setProvider(App.web3Provider);
        });

        $.getJSON(jsonAppContract, (data) => {
            var ContractArtifact = data;
            App.contracts.AppContract = TruffleContract(ContractArtifact);
            App.contracts.AppContract.setProvider(App.web3Provider);
            web3.eth.defaultAccount = web3.eth.accounts[0];
        });

        return App.bindEvents();
    },

    bindEvents: function() {
        $(document).on('click', App.handleButtonClick);
        $(document).on('change', App.handleChange);
    },

    handleChange: async (event) => {
        if (event.target.id == "flights") {
            return await App.getFlights();
        }
    },

    handleButtonClick: async (event) => {
        App.getMetaskAccountID();

        var processId = parseInt($(event.target).data('id'));
        if(event.target.id == "flights") {
                return $("#" + event.target.id + "").change();
            }
        switch (processId) {
            case 0:
                return await App.registerAirline(event);
            case 1:
                return await App.fund(event);
            case 2:
                return await App.registerFlight(event);
            case 3:
                return await App.getFlights(event);
            case 4:
                return await App.buy(event);
            case 5:
                return await App.fetchFlightStatus(event);
            case 6:
                return await App.withdraw(event);
        }
    },

    registerAirline: async (event) => {
        try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            const newAirlineAddress = $("#newAirlineAddress").val();
            await instance.registerAirline(newAirlineAddress);
            console.log(`Succeesfully registered or voted airline ${newAirlineAddress}`);
        } catch(error) {
            console.log(error);
        };
    },

    fund: async (event) => {
        try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            const amount = web3.toWei($("#fundAirlineFee").val(), 'ether');
            const result = await instance.fund({value: amount});
            console.log('Successsfully funded airline');
        } catch(error) {
            console.log(error);
        };
    },

    registerFlight: async (event) => {
        try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            const flightAirlineAddress = $("#newFlightAirlineAddress").val();
            const flightName = web3.fromAscii($("#newFlightName").val());
            const flightTimestamp = Number($("#newFlightTimestamp").val());
            if(flightName && flightAirlineAddress && flightTimestamp) {
                await instance.registerFlight(flightAirlineAddress, flightName, flightTimestamp);
                const flightdetail = (flightName + " at time: " + flightTimestamp.toString());
                $("#flights").append(flightdetail);
                console.log(`Successsfully registered flight ${flightName}`);
            } else {
                alert('Please insert flight details');
            }
        } catch(error) {
            console.log(error);
        };
    },

    getFlights: async (event) => {
       try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            let flightCount = await instance.getFlightCount();
            if(Number(flightCount) > 0){
                var option = '';
                let flightNumberReadable;
                for(i = 0; i < Number(flightCount); i++) {
                  let flightNumber = await instance.getFlightNumber(i);
                  flightNumberReadable = web3.toUtf8(flightNumber);
                  let flightTime =await instance.getFlightTime(i);
                  flightTimeReadable = Date(flightTime);
                  flightDetail = flightNumberReadable + ' departing at: ' + flightTimeReadable;
                  option += '<option value="'+ flightDetail + '">' + flightDetail + '</option>';
                }
                $("#flights").empty();
                $("#flights").append(option);
                //$("#flights").val(web3.toUtf8(flightNumbers[0])).change();
            }
            console.log(`getFlight Successful`);
        } catch(error) {
            console.log(error);
        };
    },

    buy: async (event) => {
        try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            let flightIndex = $("select#flights option:selected").index();
            let flightNumber = await instance.getFlightNumber(flightIndex);
            let flightTime =await instance.getFlightTime(flightIndex);
            let flightAirline = await instance.getFlightAirline(flightIndex);
            let amountInWei = $("#insuranceAmount").val();
            if(flightNumber && amountInWei){
                await instance.buy(flightAirline, flightNumber, flightTime, {value: amountInWei});
                console.log(`Successsfully bought insurance for flight`);
            } else {
                alert('Select a flight and enter an insurance amount');
            }
        } catch(error) {
            console.log(error);
        };
    },

    fetchFlightStatus: async (event) => {
        try {
            event.preventDefault();
            const instance = await App.contracts.AppContract.deployed();
            let flightIndex = $("select#flights option:selected").index();
            let flightN = await instance.getFlightNumber(flightIndex);
            let flightNumber = web3.toUtf8(flightN).toString();
            let flightT =await instance.getFlightTime(flightIndex);
            let flightTime = Number(flightT);
            let flightAirline = await instance.getFlightAirline(flightIndex);
            if(flightIndex){
                await instance.fetchFlightStatus(flightAirline, flightNumber, flightTime);
                console.log(`Successsfully requested flight statuses with Flight Oracles`);
            } else {
                alert('Please select a flight number in order to check status');
            }
        } catch(error) {
            console.log(error);
        };
    },

    withdraw: async (event) => {
        try {
            event.preventDefault();
            let amountToWithdraw = $("#insuranceAmountToWithdraw").val();
            if(amountToWithdraw && Number(amountToWithdraw) > 0){
                const instance = await App.contracts.AppContract.deployed();
                await instance.withdraw(web3.toWei(amountToWithdraw, 'Wei'));
                console.log(`Successsfully withdrew Ether`);
            } else {
                alert('Please input an amount to withdraw');
            }
        } catch(error) {
            console.log(error);
        };
    },

};

$(function () {
    $(window).load(function () {
        App.init();
    });
});
