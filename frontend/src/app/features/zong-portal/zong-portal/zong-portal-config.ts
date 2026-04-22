import { TableConfig } from '../../../shared/form-model/data-table-model';
import { FormConfig } from '../../../shared/form-model/dynamic-form-model';

export const ZONG_PORTAL_FORM: FormConfig = {
    title: 'Fetch From Zong',
    fields: [],
};

export const ZONG_PORTAL_EDIT_FORM: FormConfig = {
    title: 'Edit Call Log',
    fields: [
        {
            key: 'msisdn',
            label: 'MSISDN',
            type: 'text',
            required: true,
        },
        {
            key: 'callDate',
            label: 'Call Date',
            type: 'date',
            required: true,
        },
        {
            key: 'direction',
            label: 'Direction',
            type: 'select',
            required: true,
            options: [
                { value: 'INCOMING', label: 'Incoming' },
                { value: 'OUTGOING', label: 'Outgoing' },
            ],
        },
        {
            key: 'duration',
            label: 'Duration',
            type: 'text',
            required: false,
        },
        {
            key: 'status',
            label: 'Status',
            type: 'text',
            required: false,
        },
    ],
};

export const ZONG_PORTAL_TABLE: TableConfig = {
    globalSearch: {
        placeholder: 'Search MSISDN, Direction, Status',
        keys: ['msisdn', 'direction', 'status'],
        rules: {
            mode: 'alphanumeric',
            maxLength: 30,
            trim: true,
        },
    },

    columns: [
        {
            key: 'msisdn',
            title: 'MSISDN',
        },
        {
            key: 'callDateDisplay',
            title: 'Call Date',
            filter: {
                type: 'date',
                placeholder: 'Call Date',
            },
        },
        {
            key: 'direction',
            title: 'Direction',
            filter: {
                type: 'select',
                placeholder: 'Direction',
                options: [
                    { value: 'INCOMING', label: 'Incoming' },
                    { value: 'OUTGOING', label: 'Outgoing' },
                ],
            },
        },
        {
            key: 'duration',
            title: 'Duration',
        },
        {
            key: 'status',
            title: 'Status',
            filter: {
                type: 'select',
                placeholder: 'Status',
                options: [],
            },
        },
    ],

    pagination: true,
};