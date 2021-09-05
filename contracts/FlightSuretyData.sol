pragma solidity >=0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    // Airline data object
    struct Airline {
        bool isRegistered;
        bool antePaid;
    }

    // Passenger data object
    struct Passenger {
        address passenger;
        bytes32 flightKey;
        bool isInsured;
        uint256 insurancePurchased;
        uint256 insuranceOwed;
    }

    // Flight data object
    struct Flight {
        bool isRegistered;
        uint256 timestamp;
        address airline;
        string flight;
        address[] passengers;
    }

    //Mapping for data objects
    mapping(address => Airline) public Airlines;
    mapping(address => Passenger) public Passengers;
    mapping(bytes32 => Flight) public Flights;

    //Counter for number of Airlines in consortia
    uint256 airlineCount = 0;

    //Counter for number of Flights registered
    uint256 flightCount = 0;

    //Array of all registered flights
    Flight[] flights;

    /********************************************************************************************/
    /*                                     CONSTRUCTOR DEFINITIONS                              */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor() public
    {
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the an existing "Airline"
    */
    modifier requireExistingAirline(address airline)
    {
        require(Airlines[airline].isRegistered, "Caller is not an existing airline");
        _;
    }

    /**
    * @dev Modifier that requires the flight to exist
    */
    modifier requireExistingFlight(address airline, string memory flight, uint256 timestamp)
    {
        require(Flights[getFlightKey(airline, flight, timestamp)].isRegistered, "The flight does not exists");
        _;
    }

    /**
    * @dev Modifier that requires the flight to exist
    */
    modifier requireAntePaid(address airline)
    {
        require(Airlines[airline].antePaid, "Caller has not paid the ante");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool)
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus (bool mode) external requireContractOwner
    {
        operational = mode;
    }

    /**
    * @dev Get the registration status of a airline
    */
    function isAirlineRegistered(address airline) external view returns(bool)
    {
        return Airlines[airline].isRegistered;
    }

    /**
    * @dev Get the ante status of a airline
    */
    function isAntePaid(address airline) external view returns(bool)
    {
        return Airlines[airline].antePaid;
    }

    /**
    * @dev Get the current count of airlines
    */
    function getAirlineCount() external view returns(uint256)
    {
        return airlineCount;
    }

    /**
    * @dev Get the current count of airlines
    */
    function getFlightCount() external view returns(uint256)
    {
        return flightCount;
    }

    /**
    * @dev Get the registration status of a airline
    */
    function isFlightRegistered(bytes32 flightkey) external view returns(bool)
    {
        return Flights[flightkey].isRegistered;
    }

    /**
    * @dev Get the passengers on a specific flight
    */
    function getPassengers(bytes32 flightkey) external view returns(address[] memory)
    {
        return Flights[flightkey].passengers;
    }


    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline (address airline) public requireIsOperational
    {
        require(!Airlines[airline].isRegistered, "Duplicate: Airline has previously been registered");
        Airlines[airline] = Airline(true, false);
        airlineCount = airlineCount + 1;
    }

    /**
    * @dev Add a flight to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerFlight(address airline, string memory flight, uint256 timestamp) public requireIsOperational
    requireExistingAirline(airline)
    requireAntePaid(airline)
    {
        bytes32 flightkey = getFlightKey(airline, flight, timestamp);
        require(!Flights[flightkey].isRegistered, "Flight has already been registered");
        Flights[flightkey] = Flight(true, timestamp, airline, flight, new address[](0));
        flights.push(Flight(true, timestamp, airline, flight, new address[](0)));
        flightCount = flightCount + 1;
    }

    /**
    * @dev Get list of flights and departures
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function getFlightNumber(uint256 flightIndex) external view requireIsOperational returns(string memory)
    {
        return flights[flightIndex].flight;
    }

    /**
    * @dev Get list of flights and departures
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function getFlightTime(uint256 flightIndex) external view requireIsOperational returns(uint256)
    {
        return flights[flightIndex].timestamp;
    }

    /**
    * @dev Get list of flights and departures
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function getFlightAirline(uint256 flightIndex) external view requireIsOperational returns(address)
    {
        return flights[flightIndex].airline;
    }

    /**
    * @dev Buy insurance for a flight
    *
    */
    function buy(address passenger, address airline, string calldata flight, uint256 timestamp, uint256 amount) external requireIsOperational
    requireExistingFlight(airline, flight, timestamp)
    {
        bytes32 flightkey = getFlightKey(airline, flight, timestamp);
        Passengers[passenger] = Passenger(passenger, flightkey, true, amount, 0);
        Flights[flightkey].passengers.push(passenger);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address passenger, bytes32 flightkey) public requireIsOperational
    {
        require(Passengers[passenger].isInsured, "Passenger does not exist or is not insured");
        require(Passengers[passenger].flightKey == flightkey, "Passenger is not insured for this flight");
        uint256 insurancePayout = Passengers[passenger].insurancePurchased.mul(15).div(10);
        Passengers[passenger].isInsured = true;
        Passengers[passenger].insuranceOwed = insurancePayout;
    }


    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address payable insuredPassenger, uint256 amount) external payable requireIsOperational
    {
        require(Passengers[insuredPassenger].isInsured, "Passenger is not insured");
        require(amount <= Passengers[insuredPassenger].insuranceOwed, "Insufficient insurance payout balance");
        //Passengers[insuredPassenger].insuranceOwed = Passengers[insuredPassenger].insuranceOwed.sub(amount);
        insuredPassenger.transfer(amount);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(address airline) public payable requireIsOperational requireExistingAirline(airline)
    {
        Airlines[airline].antePaid = true;
    }

    function getFlightKey (address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable
    {
    }
}
