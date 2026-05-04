import { check } from 'k6';
import { browser } from 'k6/browser'
import  http from 'k6/http'

export const options = {
    // 4 to 5 users will be simulated for 30 seconds
    scenarios: {
        ui: {
            executor: 'shared-iterations',
            exec: 'browserTest',
            vus: 2,
            maxDuration: '1m',
            iterations: 4,
            options: {
                browser: {
                    type: 'chromium',
                },
            },
        },
        be: {
            executor:'constant-vus',
            exec: 'backendStress',
            vus: 10,
            duration: '1m'
        }

    }

}
thresholds: {
    checks: ['rate==0.1']

}

export async function browserTest() {

    // const context = browser.newContext();
    const page = await browser.newPage();
    await page.goto("https://rahulshettyacademy.com/locatorspractice/");
    await page.locator("#inputUsername").type("rahul");
    await page.getByRole('textbox', { name: 'Password' }).type("rahulshettyacademy");
    await page.getByRole('button', { name: 'Sign In' }).click();
    console.log("Sucessfully logged in");
    await page.waitForTimeout(2000);
    const headerText = await page.locator("h1").first().textContent();
    check(headerText, {
        header: (text) => {
            return text.includes("Welcome to Rahul Shetty Academy");
        }
    })
    await page.close();
}

export async function backendStress() {
    const res = http.get("https://rahulshettyacademy.com/locatorspractice/");
    check(res, {
        "status is 200": (r) => r.status === 200
    })
}