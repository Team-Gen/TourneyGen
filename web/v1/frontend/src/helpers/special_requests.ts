import ApiRequest from '../api_request/api_request';

// Publicly exported functions for external use.

export function api_chained_request(requests: ApiRequest[], callback: (compiled_data: object) => void) {
    /*
    * api_chained_request: Call multiple requests providing a filtered version of the output from the
    *                      previous call to the current call.
    *
    * requests: A list of RequestObjects used to generate the requests.
    * callback: A callback that will be called with the filtered response data from the final request.
    *
    *
    * Note, any keys provided in the request.data will overwrite those generated by a chained request.
    * In other words, if request.data contains `key`, and the previous request's response contains `key`
    * then the `key` value will be that from request.data, not from the previous request's response
    */

    // Verify the contents of the RequestObjects.
    for (const req of requests) {
        if (!(['GET', 'POST', 'PUT', 'DELETE'].includes(req.type))) {
            console.error('Unable to submit a request of the type: "' + req.type + '".');
            return callback(null);
        }
    }

    recurse_api_chained_request([{}, {}], requests, callback);
}

export function api_get_multiple_requests(requests: ApiRequest[], callback) {
    console.log('Submitting ' + requests.length + ' GET requests from api_get_multiple_requests.');
    const result: object[] = [];
    let request_number = 0;

    if (requests.length === 0) {
        console.log('Found empty request list. Responding with no responses.');
        return callback([]);
    }

    for (const req of requests) {
        req.send_request((response) => {
            result.push(response);

            if (request_number === requests.length - 1) {
                console.log('Sending responses to the GET requests.');
                return callback(result);
            }
            request_number++;
        });
    }
}

// Private methods for internal use only.

function recurse_api_chained_request(previous_data: object[], requests: ApiRequest[], callback: (compiled_data: object) => void) {
    // Recurse the api request across multiple requests.

    if (requests.length === 0) {
        return callback(previous_data[ApiRequest.FILTER_RETURN_DATA_IND]);
    }

    // Regenerate the request objects based on previous values. {...a, ...b} will combine
    // the objects a and b into one object, where any duplicated keys replaced by b.
    requests[0].request_params = { ...previous_data[ApiRequest.FILTER_PARAM_IND], ...requests[0].request_params };

    chain_request(previous_data, requests[0], (response_data) => {
        recurse_api_chained_request(response_data, requests.slice(1), callback);
    });
}

function chain_request(previous_request_data: object[], req: ApiRequest, chain_callback) {

    req.request_params = { ...previous_request_data[ApiRequest.FILTER_PARAM_IND], ...req.request_params };
    req.request_body = { ...previous_request_data[ApiRequest.FILTER_BODY_IND], ...req.request_body };

    req.send_request((data) => {
        chain_callback(req.response_filter(data));
    });
}
