import { sleep, check, group } from 'k6';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = 'https://quickpizza.grafana.com';
const PASSWORD = "securepassword12345678";

const authenticationRate = new Rate('authentication_rate'); //1,0,1,1,0
const sucessfulOrders = new Counter('successful_orders');

function randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randIndex = Math.floor(Math.random() * chars.length);
        result += chars.charAt(randIndex);
    }
    return result;

}

export const options = {
    stages: [
        { duration: '5s', target: 2 }, // Ramp up to 2 VU over 5 seconds
        { duration: '6s', target: 4 }, // Stay at 4 VU for 6 seconds
        { duration: '3s', target: 0 } // Ramp down to 0 VUs over 3 seconds
    ],
    thresholds: {
        'http_req_duration': ['p(95) < 450'], // 95% of requests should be below 500ms
        'http_req_failed': ['rate < 0.1'], // Less than 10% of requests should fail
        'checks': ['rate > 0.9'], // At least 90% of checks should pass
        'iteration_duration': ['p(95) < 8000'], // 95% of iterations should complete within 1 second
        'group_duration{group:::Order management}': ['p(95) < 1500'], // 95% of Order management group should complete within 5 seconds
        'authentication_rate': ['rate > 0.9'], // At least 90% of authentication attempts should be successful
        'successful_orders': ['count > 5'] // At least 1 successful order should be created
    }
    //
};

export default function () {
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
