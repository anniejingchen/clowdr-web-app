import React, { useState, useRef, useContext, useEffect } from 'react';
import { Button, DatePicker, Form, Input, Popconfirm, Select, Space, Spin, Table } from "antd";
import Parse from "parse";
import { AuthUserContext } from "../../../Session";
import { DeleteOutlined, EditOutlined, SaveTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { ClowdrState, EditableCellProps } from "../../../../ClowdrTypes";
import { SelectValue } from "antd/es/select";
import { Store } from 'antd/lib/form/interface';
import assert from 'assert';
var moment = require('moment');
var timezone = require('moment-timezone');

// const {TabPane} = Tabs;
// const IconText = ({icon, text}) => (
//     <Space>
//         {React.createElement(icon)}
//         {text}
//     </Space>
// );

interface ProgramSessionsProps {
    auth: ClowdrState;
}

interface ProgramSessionsState {
    loading: boolean;
    toggle: boolean;
    searched: boolean;
    ProgramSessions: Parse.Object[];
    ProgramRooms: Parse.Object[];
    ProgramItems: Parse.Object[];
    searchResult: Parse.Object[];
    ProgramSessionEvents: Parse.Object[];
    alert: string;
    visible: boolean
}

class ProgramSessions extends React.Component<ProgramSessionsProps, ProgramSessionsState> {
    constructor(props: ProgramSessionsProps) {
        super(props);
        console.log(this.props);
        this.state = {
            loading: true,
            toggle: false,
            searched: false,
            ProgramSessions: [],
            ProgramRooms: [],
            ProgramItems: [],
            ProgramSessionEvents: [],
            searchResult: [],
            alert: "",
            visible: false
        };
    }

    setVisible() {
        this.setState({ 'visible': !this.state.visible });
    }

    async componentDidMount() {
        let [sessions, rooms, items, events] = await Promise.all([
            this.props.auth.programCache.getProgramSessions(this),
            this.props.auth.programCache.getProgramRooms(this),
            this.props.auth.programCache.getProgramItems(this),
            this.props.auth.programCache.getProgramSessionEvents(this)
        ]);
        this.setState({
            ProgramSessions: sessions,
            ProgramRooms: rooms,
            ProgramItems: items,
            ProgramSessionEvents: events,
            loading: false
        });
    }

    componentWillUnmount() {
        this.props.auth.programCache.cancelSubscription("ProgramSession", this, undefined);
        this.props.auth.programCache.cancelSubscription("ProgramItem", this, undefined);
        this.props.auth.programCache.cancelSubscription("ProgramRoom", this, undefined);
        this.props.auth.programCache.cancelSubscription("ProgramSessionEvent", this, undefined);  // ??
    }

    onCreate = () => {
        assert(this.props.auth.currentConference, "Current conference is null");

        let data: object = {
            clazz: "ProgramSession",
            conference: { clazz: "ClowdrInstance", id: this.props.auth.currentConference.id },
            title: "***NEWLY ADDED SESSION***",
            items: [],
            confKey: Math.floor(Math.random() * 10000000).toString()
        }

        Parse.Cloud.run("create-obj", data)
            .then(() => {
                console.log("[Admin/Sessions]: sent new object to cloud");
                this.setVisible();
            })
            .catch((err: Error) => {
                this.setState({ alert: "add error" })
                console.log("[Admin/Sessions]: Unable to create: " + err)
            })
    }

    render() {
        if (this.state.loading)
            return <Spin />

        const { Option } = Select;
        function onChange(value: SelectValue) {
            console.log(`selected ${value}`);
        }

        function onBlur() {
            console.log('blur');
        }

        function onFocus() {
            console.log('focus');
        }

        function onSearch(val: string) {
            console.log('search:', val);
        }

        // Set up editable table cell
        const EditableCell: React.FC<EditableCellProps> =
            ({ editing, dataIndex, title, inputType,
                record, index, children,
                ...restProps }): JSX.Element => {
                let inputNode: JSX.Element | null;
                switch (dataIndex) {
                    case ('title'):
                        inputNode = <Input />;
                        break;
                    case ('start'):
                        inputNode = <DatePicker showTime={{ format: 'HH:mm' }} />;
                        break;
                    case ('end'):
                        inputNode = <DatePicker showTime={{ format: 'HH:mm' }} />;
                        break;
                    case ('room'):
                        inputNode = (
                            <Select placeholder="Choose the room" >
                                {this.state.ProgramRooms.map(r => (
                                    <Option key={r.id} value={r.get('name')}>{r.get('name')}</Option>
                                ))}
                            </Select>
                        );
                        break;
                    case ('items'):
                        inputNode = (
                            <Select
                                showSearch
                                mode="multiple"
                                placeholder="Select an item"
                                optionFilterProp="children"
                                onChange={onChange}
                                onFocus={onFocus}
                                onBlur={onBlur}
                                onSearch={onSearch}
                                filterOption={(input: string, option: any): boolean =>
                                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                }
                            >
                                {this.state.ProgramItems.map((it: Parse.Object): JSX.Element => (
                                    <Option key={it.id} value={it.id}>{it.get('title')}</Option>
                                ))}
                            </Select>
                        );
                        break;

                    default:
                        inputNode = null;
                        break;
                }

                return (
                    <td {...restProps}>
                        {editing ? (
                            <Form.Item
                                name={dataIndex}
                                style={{
                                    margin: 0,
                                }}
                                rules={dataIndex === 'title' ?
                                    [{ required: true, message: `Please Input ${title}!` }] : []}
                            >
                                {inputNode}
                            </Form.Item>
                        ) : (
                                children
                            )}
                    </td>
                );
            };

        // set up editable table
        const EditableTable = () => {
            const [form] = Form.useForm();
            const [data, setData] = useState(this.state.ProgramSessions);
            const [editingKey, setEditingKey] = useState('');

            const isEditing = (record: Parse.Object): boolean => record.id === editingKey;

            const edit = (record: Parse.Object): void => {
                let currentItems: string[] = [];
                if (record.get("items")) {
                    record.get("items").forEach((a: Parse.Object) => {
                        currentItems.push(a.id);
                    })
                }
                form.setFieldsValue({
                    title: record.get("title") ? record.get("title") : "",
                    start: record.get("startTime") ? moment(record.get("startTime")) : "",
                    end: record.get("endTime") ? moment(record.get("endTime")) : "",
                    room: record.get("room") ? record.get("room").get("name") : "",
                    items: currentItems
                });
                setEditingKey(record.id);
            };

            const cancel = (): void => {
                setEditingKey('');
            };

            const onDelete = (record: Parse.Object): void => {
                console.log("deleting session: " + record.get("title"));
                // delete from database
                let data: object = {
                    clazz: "ProgramSession",
                    conference: { clazz: "ClowdrInstance", id: record.get("conference").id },
                    id: record.id
                }
                Parse.Cloud.run("delete-obj", data)
                    .then(() => this.setState({
                        alert: "delete success",
                        searchResult: this.state.searched ? this.state.searchResult.filter(r => r.id !== record.id) : []
                    }))
                    .catch((err: Error) => {
                        this.setState({ alert: "delete error" })
                        console.log("[Admin/Sessions]: Unable to delete: " + err)
                    })
            };

            const save = async (id: string) => {
                console.log("Entering save func");
                try {
                    const row: Store = await form.validateFields();
                    const newData: Parse.Object[] = [...data];
                    let session: Parse.Object | undefined = newData.find(s => s.id === id);

                    if (session) {
                        let newRoom: Parse.Object | undefined = this.state.ProgramRooms.find(t => t.get('name') === row.room);
                        let newItems: Parse.Object[] = [];
                        for (let item of row.items) {
                            let newItem: Parse.Object | undefined = this.state.ProgramItems.find(t => t.id === item);
                            if (newItem) {
                                newItems.push(newItem);
                            } else {
                                console.log("Item " + item + " not found");
                            }
                        }

                        let data = {
                            clazz: "ProgramSession",
                            conference: { clazz: "ClowdrInstance", id: session.get("conference").id },
                            id: session.id,
                            title: row.title,
                            startTime: row.start.toDate(),
                            endTime: row.end.toDate(),
                            room: row.room,
                            items: row.items  // item CANNOT be null
                        }
                        if (newRoom) {
                            console.log("Room found. Updating");
                            data.room = { clazz: "ProgramRoom", id: newRoom.id }
                        }
                        if (newItems.length > 0)
                            data.items = newItems.map((i: Parse.Object) => { return { clazz: "ProgramItem", id: i.id } })

                        console.log(data);
                        Parse.Cloud.run("update-obj", data)
                            .then(() => {
                                this.setState({ alert: "save success" });
                            })
                            .catch((err: Error) => {
                                this.setState({ alert: "save error" });
                                console.log("[Admin/Sessions]: Unable to save: " + err);
                            })
                        setData(newData);
                        setEditingKey('');
                    }
                    else {
                        newData.push(row as Parse.Object);
                        setData(newData);
                        setEditingKey('');
                    }
                } catch (errInfo) {
                    console.log('Validate Failed:', errInfo);
                }
            };

            const columns = [
                {
                    title: 'Title',
                    dataIndex: 'title',
                    key: 'title',
                    width: '30%',
                    editable: true,
                    // defaultSortOrder: 'ascend',
                    sorter: (a: Parse.Object, b: Parse.Object) => {
                        let titleA: string = a.get("title") ? a.get("title") : "";
                        let titleB: string = b.get("title") ? b.get("title") : "";
                        return titleA.localeCompare(titleB);
                    },
                    render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("title")}</span>,
                },
                {
                    title: 'Start Time',
                    dataIndex: 'start',
                    width: '15%',
                    editable: true,
                    sorter: (a: Parse.Object, b: Parse.Object) => {
                        let timeA: Date = a.get("startTime") ? a.get("startTime") : new Date();
                        let timeB: Date = b.get("startTime") ? b.get("startTime") : new Date();
                        return timeA > timeB;
                    },
                    render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("startTime") ? timezone(record.get("startTime")).tz(timezone.tz.guess()).format("YYYY-MM-DD HH:mm z") : ""}</span>,
                    key: 'start',
                },
                {
                    title: 'End Time',
                    dataIndex: 'end',
                    width: '15%',
                    editable: true,
                    sorter: (a: Parse.Object, b: Parse.Object) => {
                        let timeA: Date = a.get("endTime") ? a.get("endTime") : new Date();
                        let timeB: Date = b.get("endTime") ? b.get("endTime") : new Date();
                        return timeA > timeB;
                    },
                    render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("endTime") ? timezone(record.get("endTime")).tz(timezone.tz.guess()).format("YYYY-MM-DD HH:mm z") : ""}</span>,
                    key: 'end',
                },
                {
                    title: 'Room',
                    dataIndex: 'room',
                    width: '15%',
                    editable: true,
                    sorter: (a: Parse.Object, b: Parse.Object) => {
                        const roomA = a.get("room") && a.get("room").get("name") ? a.get("room").get("name") : " ";
                        const roomB = b.get("room") && b.get("room").get("name") ? b.get("room").get("name") : " ";
                        return roomA.localeCompare(roomB);
                    },
                    render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("room") ? record.get("room").get('name') : ""}</span>,
                    key: 'room',
                },
                {
                    title: 'Items',
                    dataIndex: 'items',
                    width: '25%',
                    editable: true,
                    render: (_: string, record: Parse.Object): JSX.Element => {
                        if (record.get("events")) {
                            const curEvents = record.get("events").sort((a:Parse.Object, b:Parse.Object) => a.get("startTime") - b.get("startTime"));
                            return <ul>{
                                curEvents.map((event: Parse.Object) => (
                                    <li key={event.id}>
                                        <span>{event.get('programItem').get('title')} {timezone(event.get("startTime")).tz(timezone.tz.guess()).format("HH:mm z")}</span>
                                    </li>
                                ))
                            }</ul>
                        }
                        else {
                            return <p>NO SUCH THING</p>
                        }
                    },
                    key: 'items',
                },
                {
                    title: 'Action',
                    dataIndex: 'action',
                    // width: '10%',
                    render: (_: string, record: Parse.Object): JSX.Element | null => {
                        const editable: boolean = isEditing(record);
                        if (this.state.ProgramSessions.length > 0) {
                            return editable ? (
                                <span>
                                    <a
                                        onClick={() => save(record.id)}
                                        style={{
                                            marginRight: 8,
                                        }}
                                    >
                                        {<SaveTwoTone />}
                                    </a>
                                    <Popconfirm title="Sure to cancel?" onConfirm={cancel}>
                                        <a>{<CloseCircleTwoTone />}</a>
                                    </Popconfirm>
                                </span>
                            ) : (
                                    <Space size='small'>
                                        <a title="Edit" onClick={() => { if (editingKey === '') edit(record) }}>
                                            {/*<a title="Edit" disabled={editingKey !== ''} onClick={() => edit(record)}>*/}
                                            {<EditOutlined />}
                                        </a>
                                        <Popconfirm
                                            title="Are you sure delete this session?"
                                            onConfirm={() => onDelete(record)}
                                            okText="Yes"
                                            cancelText="No"
                                        >
                                            <a title="Delete">{<DeleteOutlined />}</a>
                                        </Popconfirm>
                                    </Space>

                                );
                        } else {
                            return null;
                        }

                    },
                },
            ];
            const mergedColumns = columns.map(col => {
                if (!col.editable) {
                    return col;
                }
                return {
                    ...col,
                    onCell: (record: Parse.Object) => ({
                        record,
                        inputType: 'text',
                        dataIndex: col.dataIndex,
                        title: col.title,
                        editing: isEditing(record),
                    }),
                };
            });

            const expandedRowRender = (outterRecord:any) => {
                //@ts-ignore
                const EditableContext = React.createContext<any>();

                interface Item {
                    key: string;
                    item: string;
                    startTime: Date;
                    endTime: Date;
                }
                  
                interface EditableRowProps {
                    index: number;
                }
                  
                const EditableRow: React.FC<EditableRowProps> = ({ index, ...props }) => {
                const [form] = Form.useForm();
                    return (
                        <Form form={form} component={false}>
                            <EditableContext.Provider value={form}>
                                <tr {...props} />
                            </EditableContext.Provider>
                        </Form>
                    );
                };
                  
                interface EditableCellProps {
                    title: React.ReactNode;
                    editable: boolean;
                    children: React.ReactNode;
                    dataIndex: string;
                    record: Item;
                    handleSave: (record: Item) => void;
                }
                  
                const EditableCell: React.FC<EditableCellProps> = ({
                    title,
                    editable,
                    children,
                    dataIndex,
                    record,
                    handleSave,
                    ...restProps
                }) => {
                    const [editing, setEditing] = useState(false);
                    const inputRef = useRef();
                    const form = useContext(EditableContext);
                  
                    const toggleEdit = () => {
                        setEditing(!editing);
                        //@ts-ignore
                        form.setFieldsValue({ [dataIndex]: record[dataIndex] });
                    };
                  
                    const save = async (e: any) => {
                        try {
                            const values = await form.validateFields();
                            toggleEdit();
                            handleSave({ ...record, ...values });
                        } catch (errInfo) {
                            console.log('Save failed:', errInfo);
                        }
                    };
                  
                    let childNode = children;
                  
                    if (editable) {
                        childNode = editing ? (
                            <Form.Item
                                style={{ margin: 0 }}
                                name={dataIndex}
                                rules={[
                                    {
                                        required: true,
                                        message: `${title} is required.`,
                                    },
                                ]}
                            >
                                {/* @ts-ignore */}
                                <DatePicker showTime={{ format: 'HH:mm' }} onOk={save}/>
                            </Form.Item>
                        ) : (
                            <div className="editable-cell-value-wrap" style={{ paddingRight: 24 }} onClick={toggleEdit}>
                            {children}
                            </div>
                        );
                    }
                    return <td {...restProps}>{childNode}</td>;
                };
                  
                class EditableTable extends React.Component {
                    constructor(props: any) {
                        super(props);
                        //@ts-ignore
                        this.columns = [
                            {
                                title: 'Item',
                                dataIndex: 'item',
                                width: '30%',
                                render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get('programItem').get("title")}</span>,
                                key: 'programItem',
                            },
                            {
                                title: 'Start Time',
                                dataIndex: 'startTime',
                                editable: true,
                                render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("startTime") ? timezone(record.get("startTime")).tz(timezone.tz.guess()).format("YYYY-MM-DD HH:mm z") : ""}</span>,
                                key: 'startTime',
                            },
                            {
                                title: 'End Time',
                                dataIndex: 'endTime',
                                editable: true,
                                render: (_: string, record: Parse.Object): JSX.Element => <span>{record.get("endTime") ? timezone(record.get("endTime")).tz(timezone.tz.guess()).format("YYYY-MM-DD HH:mm z") : ""}</span>,
                                key: 'endTime',
                            },
                        ];

                        this.state = {
                            dataSource: outterRecord.get("events")
                        };

                    }
                  

                    //TODO: Save update to Parse database
                    handleSave = (row: any) => {
                        //@ts-ignore
                        const newData = [...this.state.dataSource];
                        const index = newData.findIndex(sessionEvent => row.key === sessionEvent.key);
                        
                       
                        if (index >= 0) {
                            const sessionEvent = newData[index];

                            let data = {
                                clazz: "ProgramSessionEvent",
                                conference: { clazz: "ClowdrInstance", id: sessionEvent.get("conference").id },
                                id: sessionEvent.id,
                                startTime: sessionEvent.get('startTime'),
                                endTime: sessionEvent.get('endTime'),
                            };

                            if (row.startTime) {
                                data.startTime = row.startTime.toDate();
                                newData[index].set("startTime", row.startTime.toDate());
                            }
                            if (row.endTime) {
                                data.endTime = row.endTime.toDate();   
                                newData[index].set("endTime", row.endTime.toDate());                                                
                            }

                            Parse.Cloud.run("update-obj", data)
                            .then(() => {
                                this.setState({ alert: "save success" });
                            })
                            .catch((err: Error) => {
                                this.setState({ alert: "save error" });
                                console.log("[Admin/Sessions-sessionEvent]: Unable to save: " + err);
                            })
                        }

                    };
                  
                    render() {
                        //@ts-ignore
                        const { dataSource } = this.state;
                        const components = {
                            body: {
                                row: EditableRow,
                                cell: EditableCell,
                            },
                        };
                        //@ts-ignore
                        const columns = this.columns.map((col: any) => {
                            if (!col.editable) {
                            return col;
                            }
                            return {
                                ...col,
                                onCell: (record: any) => ({
                                    record,
                                    editable: col.editable,
                                    dataIndex: col.dataIndex,
                                    title: col.title,
                                    handleSave: this.handleSave,
                                }),
                            };
                        });
                        return (
                            <Table
                                components={components}
                                rowClassName={() => 'editable-row'}
                                bordered
                                dataSource={dataSource}
                                columns={columns}
                                pagination={false}
                            />
                        );
                    }
                }
                  
                return <EditableTable />;
            };

            return (
                <Form form={form} component={false}>
                    <Table
                        components={{
                            body: {
                                cell: EditableCell,
                            },
                        }}
                        bordered
                        dataSource={this.state.searched ? this.state.searchResult : this.state.ProgramSessions}
                        columns={mergedColumns}
                        rowClassName="editable-row"
                        rowKey='id'
                        expandable={{expandedRowRender}}
                        pagination={{
                            onChange: cancel,
                        }}
                    />
                </Form>
            );
        };

        return (
            <div>
                <table style={{ width: "100%" }}>
                    <tbody>
                        <tr>
                            <td width='100%'>
                                <Input.Search
                                    allowClear
                                    onSearch={(key: string) => {
                                        if (key === "") {
                                            this.setState({ searched: false });
                                        } else {
                                            this.setState({ searched: true });
                                            this.setState({
                                                searchResult: this.state.ProgramSessions.filter(
                                                    session => (session.get('title') && session.get('title').toLowerCase().includes(key.toLowerCase()))
                                                        || (session.get('startTime') && session.get('startTime').toString().toLowerCase().includes(key.toLowerCase()))
                                                        || (session.get('endTime') && session.get('endTime').toString().toLowerCase().includes(key.toLowerCase()))
                                                        || (session.get('items') && session.get('items').some((element: Parse.Object) => element.get('title') && element.get('title').toLowerCase().includes(key)))
                                                        || (session.get('room') && session.get('room').get('name') && session.get('room').get('name').toLowerCase().includes(key.toLowerCase())))
                                            })
                                        }
                                    }}
                                />
                            </td>
                            <td>
                                <Button
                                    type="primary"
                                    onClick={() => this.onCreate()}
                                >
                                    New session
                            </Button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <EditableTable />
            </div>
        );
    }
}

const AuthConsumer = (props: ProgramSessionsProps) => (
    <AuthUserContext.Consumer>
        {value => (value == null ? <></> :  // @ts-ignore  TS: Can value really be null here?
            <ProgramSessions {...props} auth={value} />
        )}
    </AuthUserContext.Consumer>
);
export default AuthConsumer;
