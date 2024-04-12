import axios from "axios";
import { SENTIO_API_KEY, SENTIO_SQL_URL } from "../constants";
import { ExecuteOrderEvent, SentioCloseEvent, SentioEscrowEvent, SentioExecuteEvent } from "../type";

export const getCreatedOrders = async (blockNumber: number): Promise<SentioEscrowEvent[]> => {
    const { data } = await axios.post(SENTIO_SQL_URL, {
        sqlQuery: {
            sql: "SELECT * FROM `Order Created` WHERE block_number > " + blockNumber
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'api-key': SENTIO_API_KEY,
        }
    });
    const { result: { rows } } = data;
    return rows;
}

export const getExecutedOrders = async (blockNumber: number): Promise<SentioExecuteEvent[]> => {
    const { data } = await axios.post(SENTIO_SQL_URL, {
        sqlQuery: {
            sql: "SELECT * FROM `Order Executed` WHERE block_number > " + blockNumber
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'api-key': SENTIO_API_KEY,
        }
    });
    const { result: { rows } } = data;
    return rows;
}

export const getClosedOrders = async (blockNumber: number): Promise<SentioCloseEvent[]> => {
    const { data } = await axios.post(SENTIO_SQL_URL, {
        sqlQuery: {
            sql: "SELECT * FROM `Order Closed` WHERE block_number > " + blockNumber
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'api-key': SENTIO_API_KEY,
        }
    });
    const { result: { rows } } = data;
    return rows;
}