package com.app.frostprotectionsystemandroid.data.source.remote.network

import com.app.frostprotectionsystemandroid.data.model.Task
import io.reactivex.Observable
import io.reactivex.Single
import retrofit2.Response
import retrofit2.http.*

/**
 *
 */
interface ApiService {

    /**
     * This method use to get list task
     */
    @GET("api/tasks")
    fun getTasks(): Observable<List<Task>>

    /**
     * This method use to create new task
     *
     * @param task task
     */
    @POST("api/tasks")
    fun createTask(@Body task: Task): Single<Task>


    /**
     * This method use to get task detail
     *
     * @param id id of task
     */
    @GET("api/tasks/{id}")
    fun getTaskDetail(@Path("id") id: Int): Single<Task>

    /**
     * This method use to edit task
     *
     * @param id id of task
     */
    @PUT("api/tasks/{id}")
    fun editTask(@Path("id") id: Int, @Body task: Task): Single<Task>

    /**
     * This method use to delete task
     *
     * @param id id of task
     */
    @DELETE("api/tasks/{id}")
    fun deleteTask(@Path("id") id: Int): Single<Response<Unit>>
}
