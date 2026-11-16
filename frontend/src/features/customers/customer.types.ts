export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListData {
  customers: Customer[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomerPayload {
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export type UpdateCustomerPayload = Partial<CustomerPayload>;
