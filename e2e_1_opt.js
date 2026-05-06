import { sleep, check, group } from 'k6';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = 'https://quickpizza.grafana.com';


const authenticationRate = new Rate('authentication_rate'); //1,0,1,1,0
const sucessfulOrders = new Counter('successful_orders');


const configobj = JSON.parse(open('./test-config.json'));
const usersobj = JSON.parse(open('./users.json'));

const PASSWORD = usersobj.password;

function getTestConfig() {
    const testtype = __ENV.TEST_TYPE || 'smoke';
    const config = configobj[testtype];
    console.log(config);

    return config;
}

function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randIndex = Math.floor(Math.random() * chars.length);
        result += chars.charAt(randIndex);
    }
    return result;

}
const selectedConfig = getTestConfig();

export const options = {
    cloud: {
        // Project: Default project
        projectID: 7474021,
        distribution: {
            'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 },
            // 'amazon:gb:london': { loadZone: 'amazon:gb:london', percent: 33 },
            // 'amazon:au:sydney': { loadZone: 'amazon:au:sydney', percent: 33 },
        },
        // Test runs with the same name groups test runs together.
        name: 'Test e2e flow',
    },
    stages: selectedConfig.stages,

    thresholds:  selectedConfig.thresholds
    //
};

export function setup(){
const apicheck = http.get(`${BASE_URL}`);

if(apicheck.status === 0)
    {
        console.log("API is not reachable. Aborting the test.");
        throw new Error("API is not reachable. Aborting the test.");
    }

    const testconfig = {
        testStartTime: new Date().toISOString(),
    };
    return testconfig;
}

export default function (data) {
    let userRegistered = false;
    let authToken = null;
    let USERNAME = `dhiraj${randomString(7)}1`;
    let userAuthenticated = false;
    let orderSuccessful = false;
    let orderID = null;

    group('User Registration', function () {
        const registerPayload = {
            username: USERNAME,
            password: PASSWORD
        };
        const params = {
            headers: { 'Content-Type': 'application/json' }
        };

        const regresponse = http.post(`${BASE_URL}/api/users`, JSON.stringify(registerPayload), params);

        userRegistered = check(regresponse, {
            'response code is 201': (r) => r.status === 201
        });

        if (!userRegistered) {
            console.log("User registration failed. Status code: " + regresponse.status);
            return;
        }

        sleep(1);
    })

    group('User Login', function () {

        const registerPayload = {
            username: USERNAME,
            password: PASSWORD
        };

        const loginResponse = http.post(`${BASE_URL}/api/users/token/login`, JSON.stringify(registerPayload), {
            headers: { 'Content-Type': 'application/json' }
        })

        userAuthenticated = check(loginResponse, {
            'response code is 200': (r) => r.status === 200,
            'login response contains token': (r) => r.json('token') !== undefined,
            'token is valid string': (r) => typeof r.json('token') === 'string' && r.json('token').length > 4
        })

        if (userAuthenticated) {
            authenticationRate.add(1);
            authToken = loginResponse.json('token');
            console.log(`User authentication successful. Status code:  ${USERNAME}`)
        }

        else {
            authenticationRate.add(0);
            console.log("User authentication failed. Status code: " + loginResponse.status);
            console.log("Response body ${loginResponse.body} - ${loginResponse.json('token')}");
        }
    })

    group('Order management', function () {
        const params = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`

            }
        };
        const orderPayload = {
            maxCaloriesPerSlice: 1000,
            mustBeVegetarian: true,
            excludedIngredients: [],
            excludedTools: ["Pizza cutter"],
            maxNumberOfToppings: 9,
            minNUmberOfToppings: 2,
            customName: "hello"
        };

        const orderResponse = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(orderPayload), params)

        orderSuccessful = check(orderResponse, {
            'order creation status code is 200': (r) => r.status === 200,
            'order response contains order id': (r) => r.json('pizza.id') !== undefined,
            'order id matches custom name': (r) => r.json('pizza.name') === orderPayload.customName
        })
        if (orderSuccessful) {
            sucessfulOrders.add(1);
            orderID = orderResponse.json('pizza.id')
            console.log(`Order created successfully: ${orderID}`);
        }
        else {

            console.log("Order creation failed. Status code: " + orderResponse.status);
            console.log("Response body: " + orderResponse.body);
            return;
        }
        sleep(0.5);
    })
    group('Retrieve order', function () {
        const params = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`

            }
        };
        const retrieveOrderResponse = http.get(`${BASE_URL}/api/pizza/${orderID}`, params)

        const orderRetrieveSuccessful = check(retrieveOrderResponse, {
            'order retrieve status code is 200': (r) => r.status === 200,
            'order response contains order id': (r) => r.json('id') === orderID,

        })
        if (orderRetrieveSuccessful) {
            orderID = retrieveOrderResponse.json('id')
            console.log(`Order created successfully: ${orderID}`);
        }
        else {
            console.log("Order creation failed. Status code: " + retrieveOrderResponse.status);
            console.log("Response body: " + retrieveOrderResponse.body);
            return;
        }
        sleep(0.5);
    })


}

export function tearDown(data) {

}
