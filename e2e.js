import { sleep, check, group } from 'k6';
import http from 'k6/http';

const BASE_URL = 'https://quickpizza.grafana.com';
const PASSWORD = "securepassword12345678";


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
    vus: 1,
    duration: '3s'
};

export default function () {
    let userRegistered = false;
    let authToken = null;
    let USERNAME = `dhiraj${randomString(7)}`;
    let userAuthenticated = false;

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
            authToken = loginResponse.json('token');
            console.log(`User authentication successful. Status code:  ${USERNAME}`)
        }

        else {
            console.log("User authentication failed. Status code: " + loginResponse.status);
            console.log("Response body ${loginResponse.body} - ${loginResponse.json('token')}");
        }
    })
}
