import React, { useContext, useRef, useState } from 'react';
import Head from 'next/head';
import Dashboard from '@/components/Dashboard';
import Layout from '@/components/Layout';

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>worldDao • Dashboard</title>
      </Head>
      <Layout>
        <Dashboard />
      </Layout>
    </>
  );
}
